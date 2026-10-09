process.env.JWT_SECRET = 'phase-eight-test-secret-that-is-at-least-32-bytes';

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const app = require('../src/app');
const Achievement = require('../src/models/Achievement');
const Activity = require('../src/models/Activity');
const DailyChallenge = require('../src/models/DailyChallenge');
const Goal = require('../src/models/Goal');
const Session = require('../src/models/Session');
const achievementService = require('../src/services/achievementService');
const analyticsService = require('../src/services/analyticsService');
const authService = require('../src/services/authService');
const challengeService = require('../src/services/challengeService');
const goalService = require('../src/services/goalService');
const streakService = require('../src/services/streakService');
const notificationService = require('../src/services/notificationService');
const { generateToken } = require('../src/utils/jwt');
const createAppError = require('../src/utils/appError');
const { validateGoalCreate, validateGoalUpdate } = require('../src/validators/goalValidator');

const USER_A = '65a800000000000000000001';
const USER_B = '65a800000000000000000002';
const GOAL_ID = '65a800000000000000000003';
let server;
let baseUrl;
let restoreServices = [];

const serviceMocks = [
  [goalService, {
    createGoal: async (userId, input) => ({ id: GOAL_ID, userId, ...input }),
    getGoals: async (userId) => [{ userId }],
    getGoalById: async (userId, id) => ({ userId, id }),
    getGoalProgress: async (userId, id) => ({ userId, id }),
    updateGoal: async (userId, id, input) => ({ userId, id, ...input }),
    deleteGoal: async (userId, id) => ({ userId, id }),
  }],
  [streakService, { getStreak: async (userId) => ({ userId, currentStreak: 0 }) }],
  [achievementService, { getAchievements: async (userId) => [{ userId }] }],
  [challengeService, {
    getTodayChallenge: async (userId) => ({ userId, completed: false }),
    completeTodayChallenge: async (userId) => ({ userId, completed: false }),
  }],
];

before(async () => {
  restoreServices = serviceMocks.map(([service, mocks]) => {
    const original = Object.fromEntries(Object.keys(mocks).map((name) => [name, service[name]]));
    Object.assign(service, mocks);
    return [service, original];
  });
  const originalAuth = authService.getCurrentUser;
  restoreServices.push([authService, { getCurrentUser: originalAuth }]);
  authService.getCurrentUser = async (id) => {
    if (![USER_A, USER_B].includes(id)) {
      throw createAppError(401, 'Authentication required.', 'UNAUTHORIZED');
    }
    return { id, name: 'Phase 8 Test User', email: 'phase8@example.com' };
  };
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = 'http://127.0.0.1:' + server.address().port;
});

after(async () => {
  for (const [service, original] of restoreServices) Object.assign(service, original);
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

async function request(path, method = 'GET', options = {}) {
  const headers = {};
  if (!options.unauthenticated) headers.Authorization = 'Bearer ' + generateToken(options.userId || USER_A);
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(baseUrl + path, {
    method,
    headers,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
}

test('goal validation accepts daily and weekly targets and rejects spoofed fields', () => {
  assert.deepEqual(validateGoalCreate({ period: 'daily', targetMinutes: 60 }), []);
  assert.deepEqual(validateGoalCreate({ period: 'weekly', targetMinutes: 10080 }), []);
  assert.ok(validateGoalCreate({ period: 'daily', targetMinutes: 1441 }).length > 0);
  assert.ok(validateGoalCreate({ period: 'monthly', targetMinutes: 60 }).length > 0);
  assert.ok(validateGoalCreate({ period: 'daily', targetMinutes: 30, userId: USER_B }).length > 0);
  assert.ok(validateGoalUpdate({ progress: 100 }).length > 0);
});

test('all Phase 8 endpoints require auth and use verified identity', async () => {
  const routes = [
    ['/api/goals', 'GET'],
    ['/api/streaks', 'GET'],
    ['/api/achievements', 'GET'],
    ['/api/challenges/today', 'GET'],
    ['/api/challenges/today/complete', 'POST'],
  ];
  for (const [path, method] of routes) {
    assert.equal((await request(path, method, { unauthenticated: true })).status, 401);
  }

  const created = await request('/api/goals', 'POST', {
    userId: USER_B,
    body: { period: 'daily', targetMinutes: 30 },
  });
  assert.equal(created.status, 201);
  assert.equal((await created.json()).data.goal.userId, USER_B);
  assert.equal(
    (await request('/api/goals', 'POST', { body: { period: 'daily', targetMinutes: 30, userId: USER_B } })).status,
    400
  );
  assert.equal((await request('/api/goals/not-an-id')).status, 400);
  const goalId = '65a800000000000000000003';
  const ownedGoal = await request('/api/goals/' + goalId, 'GET', { userId: USER_B });
  assert.equal(ownedGoal.status, 200);
  assert.equal((await ownedGoal.json()).data.goal.userId, USER_B);
  assert.equal((await request('/api/goals/' + goalId + '/progress')).status, 200);
  assert.equal(
    (await request('/api/goals/' + goalId, 'PUT', { body: { targetMinutes: 25 } })).status,
    200
  );
  assert.equal((await request('/api/goals/' + goalId, 'DELETE')).status, 200);
  assert.equal((await request('/api/streaks', 'GET', { userId: USER_B })).status, 200);
  assert.equal((await request('/api/achievements', 'GET', { userId: USER_B })).status, 200);
  assert.equal(
    (await request('/api/challenges/today/complete', 'POST', { body: { completed: true } })).status,
    200
  );
});

test('goal progress is analytics-derived and empty history does not count as completion', async () => {
  const original = analyticsService.getAnalyticsForRange;
  const goal = {
    _id: { toString: () => GOAL_ID },
    user: USER_A,
    period: 'daily',
    targetMinutes: 30,
    isActive: true,
    createdAt: new Date('2025-02-01T00:00:00Z'),
    updatedAt: new Date('2025-02-01T00:00:00Z'),
  };
  try {
    analyticsService.getAnalyticsForRange = async () => ({ activities: [], totalDurationSeconds: 0 });
    const empty = await goalService.addProgress(goal, new Date('2025-02-12T12:00:00Z'));
    assert.equal(empty.progress.hasTrackedData, false);
    assert.equal(empty.progress.isComplete, false);
    assert.equal(empty.progress.remainingSeconds, 1800);

    analyticsService.getAnalyticsForRange = async () => ({
      activities: [{ activity: 'YouTube', durationSeconds: 900 }],
      totalDurationSeconds: 900,
    });
    const tracked = await goalService.addProgress(goal, new Date('2025-02-12T12:00:00Z'));
    assert.equal(tracked.progress.isComplete, false);
    assert.equal(tracked.progress.onTrack, true);
    assert.equal(tracked.progress.remainingSeconds, 900);
  } finally {
    analyticsService.getAnalyticsForRange = original;
  }
});

test('goal lookups always include the authenticated owner in database filters', async () => {
  const originalFindOne = Goal.findOne;
  let filter;
  try {
    Goal.findOne = async (query) => {
      filter = query;
      return null;
    };
    const getGoalById = restoreServices.find(([service]) => service === goalService)[1].getGoalById;
    await assert.rejects(
      getGoalById(USER_B, GOAL_ID),
      (error) => error.code === 'GOAL_NOT_FOUND'
    );
    assert.deepEqual(filter, { _id: GOAL_ID, user: USER_B });
  } finally {
    Goal.findOne = originalFindOne;
  }
});

test('streaks count only tracked, qualifying, consecutive completed UTC days', () => {
  const goal = {
    createdAt: new Date('2025-02-01T00:00:00Z'),
    targetMinutes: 30,
    targetHistory: [
      { period: 'daily', targetMinutes: 30, effectiveFrom: new Date('2025-02-02T00:00:00Z') },
    ],
  };
  const days = [
    { date: '2025-02-02', totalDurationSeconds: 1200, activities: [{}] },
    { date: '2025-02-03', totalDurationSeconds: 1800, activities: [{}] },
    { date: '2025-02-04', totalDurationSeconds: 1801, activities: [{}] },
    { date: '2025-02-05', totalDurationSeconds: 500, activities: [] },
    { date: '2025-02-06', totalDurationSeconds: 1200, activities: [{}] },
    { date: '2025-02-07', totalDurationSeconds: 1200, activities: [{}] },
    { date: '2025-02-08', totalDurationSeconds: 1200, activities: [{}] },
    { date: '2025-02-09', totalDurationSeconds: 1200, activities: [{}] },
    { date: '2025-02-09', totalDurationSeconds: 1200, activities: [{}] },
  ];
  assert.deepEqual(streakService.calculateStreak(days, goal, new Date('2025-02-10T12:00:00Z')), {
    currentStreak: 4,
    longestStreak: 4,
    lastCompletionDate: '2025-02-09',
  });
  assert.equal(streakService.calculateStreak([], goal, new Date('2025-02-10T12:00:00Z')).currentStreak, 0);
});

test('daily challenge completion requires real tracking and existing completion is idempotent', async () => {
  const original = {
    activity: Activity.findOne,
    session: Session.findOne,
    find: DailyChallenge.findOne,
    update: DailyChallenge.updateOne,
    notify: notificationService.createForUser,
  };
  const now = new Date('2025-02-12T12:00:00Z');
  try {
    DailyChallenge.findOne = async () => null;
    Activity.findOne = () => ({ select: async () => null });
    Session.findOne = () => ({ select: async () => null });
    await assert.rejects(
      restoreServices.find(([service]) => service === challengeService)[1]
        .completeTodayChallenge(USER_A, now),
      (error) => error.code === 'CHALLENGE_NOT_MET'
    );

    let stored = null;
    let writes = 0;
    DailyChallenge.findOne = async () => stored;
    DailyChallenge.updateOne = async (_filter, update) => {
      writes += 1;
      stored = update.$setOnInsert;
    };
    notificationService.createForUser = async () => null;
    Activity.findOne = () => ({ select: async () => ({ _id: 'completed-activity' }) });
    Session.findOne = () => ({ select: async () => null });
    const complete = restoreServices.find(([service]) => service === challengeService)[1]
      .completeTodayChallenge;
    const firstCompletion = await complete(USER_A, now);
    assert.equal(firstCompletion.completed, true);
    assert.equal(firstCompletion.completedAt, now);
    const completed = await restoreServices.find(([service]) => service === challengeService)[1]
      .completeTodayChallenge(USER_A, now);
    assert.equal(completed.completed, true);
    assert.equal(writes, 1);
  } finally {
    Activity.findOne = original.activity;
    Session.findOne = original.session;
    DailyChallenge.findOne = original.find;
    DailyChallenge.updateOne = original.update;
    notificationService.createForUser = original.notify;
  }
});

test('achievement criteria use real records and save unique user-specific unlocks', async () => {
  const original = {
    activity: Activity.findOne,
    session: Session.findOne,
    goal: Goal.findOne,
    streak: streakService.getStreak,
    analytics: analyticsService.getAnalyticsForRange,
    update: Achievement.updateOne,
    find: Achievement.find,
    notify: notificationService.createForUser,
  };
  const updates = [];
  try {
    Activity.findOne = () => ({ select: async () => ({ _id: 'tracked-record' }) });
    Session.findOne = () => ({ select: async () => null });
    Goal.findOne = () => ({
      sort: async () => ({
        targetMinutes: 600,
        isActive: true,
        createdAt: new Date('2025-01-01T00:00:00Z'),
        targetHistory: [
          { period: 'weekly', targetMinutes: 600, effectiveFrom: new Date('2025-01-01T00:00:00Z') },
        ],
      }),
    });
    streakService.getStreak = async () => ({ longestStreak: 3 });
    analyticsService.getAnalyticsForRange = async () => ({
      activities: [{ activity: 'Instagram' }],
      totalDurationSeconds: 120,
    });
    Achievement.updateOne = async (filter, update, options) => updates.push({ filter, update, options });
    Achievement.find = () => ({
      select: async () => updates.map(({ filter }) => ({
        achievementId: filter.achievementId,
        unlockedAt: new Date('2025-02-12T12:00:00Z'),
      })),
    });
    notificationService.createForUser = async () => null;

    const items = await restoreServices.find(([service]) => service === achievementService)[1]
      .getAchievements(USER_A, new Date('2025-02-12T12:00:00Z'));
    assert.equal(items.length, 3);
    assert.ok(items.every((item) => item.unlocked && item.unlockedAt));
    assert.ok(updates.every(({ filter, options, update }) =>
      filter.user === USER_A && options.upsert && update.$setOnInsert
    ));

    updates.length = 0;
    Activity.findOne = () => ({ select: async () => null });
    streakService.getStreak = async () => ({ longestStreak: 0 });
    Goal.findOne = () => ({ sort: async () => null });
    Achievement.find = () => ({ select: async () => [] });
    const locked = await restoreServices.find(([service]) => service === achievementService)[1]
      .getAchievements(
      USER_B,
      new Date('2025-02-12T12:00:00Z')
      );
    assert.ok(locked.every((item) => !item.unlocked && item.unlockedAt === null));
    assert.equal(updates.length, 0);
  } finally {
    Activity.findOne = original.activity;
    Session.findOne = original.session;
    Goal.findOne = original.goal;
    streakService.getStreak = original.streak;
    analyticsService.getAnalyticsForRange = original.analytics;
    Achievement.updateOne = original.update;
    Achievement.find = original.find;
    notificationService.createForUser = original.notify;
  }
});
