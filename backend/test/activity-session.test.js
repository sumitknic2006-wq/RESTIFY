process.env.JWT_SECRET = 'activity-session-test-secret-at-least-32-bytes';

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const app = require('../src/app');
const Activity = require('../src/models/Activity');
const Session = require('../src/models/Session');
const activityService = require('../src/services/activityService');
const sessionService = require('../src/services/sessionService');
const authService = require('../src/services/authService');
const { generateToken } = require('../src/utils/jwt');
const createAppError = require('../src/utils/appError');
const { validateActivityStart } = require('../src/validators/activityValidator');

const USER_A = '65a100000000000000000001';
const USER_B = '65a100000000000000000002';
const SESSION_ID = '65a100000000000000000003';

let server;
let baseUrl;
let originalAuth;
let originalActivityMethods;
let originalSessionMethods;
let activityServiceMethods;
let sessionServiceMethods;
const calls = [];

before(async () => {
  originalAuth = authService.getCurrentUser;
  authService.getCurrentUser = async (id) => {
    if (![USER_A, USER_B].includes(id)) {
      throw createAppError(401, 'Authentication required.', 'UNAUTHORIZED');
    }
    return { id, name: 'Usage Test User', email: 'usage@example.com' };
  };

  activityServiceMethods = {
    startActivity: activityService.startActivity,
    stopActivity: activityService.stopActivity,
    getUserActivities: activityService.getUserActivities,
    getTodayActivities: activityService.getTodayActivities,
  };
  sessionServiceMethods = {
    startSession: sessionService.startSession,
    pauseSession: sessionService.pauseSession,
    resumeSession: sessionService.resumeSession,
    endSession: sessionService.endSession,
    getSessions: sessionService.getSessions,
    getActiveSession: sessionService.getActiveSession,
  };

  activityService.startActivity = async (userId, input) => {
    calls.push(['activityStart', userId, input]);
    return { id: 'activity-1', activity: input.activity, startTime: new Date(), endTime: null };
  };
  activityService.stopActivity = async (userId) => {
    calls.push(['activityStop', userId]);
    return { id: 'activity-1', durationSeconds: 12 };
  };
  activityService.getUserActivities = async (userId) => {
    calls.push(['activityList', userId]);
    return [{ id: 'activity-1' }];
  };
  activityService.getTodayActivities = async (userId) => {
    calls.push(['activityToday', userId]);
    return [];
  };

  sessionService.startSession = async (userId) => {
    calls.push(['sessionStart', userId]);
    return { id: SESSION_ID, status: 'active', durationSeconds: 0 };
  };
  sessionService.pauseSession = async (userId, id) => {
    calls.push(['pause', userId, id]);
    return { id, status: 'paused', durationSeconds: 4 };
  };
  sessionService.resumeSession = async (userId, id) => {
    calls.push(['resume', userId, id]);
    return { id, status: 'active', durationSeconds: 4 };
  };
  sessionService.endSession = async (userId, id) => {
    calls.push(['end', userId, id]);
    return { id, status: 'completed', durationSeconds: 8 };
  };
  sessionService.getSessions = async (userId) => {
    calls.push(['sessionList', userId]);
    return [{ id: SESSION_ID, status: 'completed' }];
  };
  sessionService.getActiveSession = async (userId) => {
    calls.push(['sessionActive', userId]);
    return null;
  };

  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  authService.getCurrentUser = originalAuth;
  Object.assign(activityService, activityServiceMethods);
  Object.assign(sessionService, sessionServiceMethods);
  if (originalActivityMethods) {
    Activity.findOne = originalActivityMethods.findOne;
    Activity.findOneAndUpdate = originalActivityMethods.findOneAndUpdate;
    Activity.find = originalActivityMethods.find;
  }
  if (originalSessionMethods) {
    Session.findOne = originalSessionMethods.findOne;
  }
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

async function request(path, method, { body, userId = USER_A, unauthenticated = false } = {}) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(unauthenticated ? {} : { Authorization: `Bearer ${generateToken(userId)}` }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

test('activity validation requires a safe activity target and rejects client ownership/duration', () => {
  assert.deepEqual(validateActivityStart({ activity: 'Instagram' }), []);
  assert.deepEqual(validateActivityStart({ activity: 'example.com', target: 'https://example.com' }), []);
  assert.ok(validateActivityStart({ activity: '' }).some((error) => error.field === 'activity'));
  assert.ok(
    validateActivityStart({ activity: 'Instagram', durationSeconds: 99 }).some(
      (error) => error.field === 'durationSeconds'
    )
  );
  assert.ok(
    validateActivityStart({ activity: 'Instagram', userId: USER_B }).some(
      (error) => error.field === 'userId'
    )
  );
});

test('activity and session routes require authentication and use verified user identity', async () => {
  calls.length = 0;

  assert.equal((await request('/api/activities', 'GET', { unauthenticated: true })).status, 401);
  assert.equal((await request('/api/sessions', 'GET', { unauthenticated: true })).status, 401);

  const startedActivity = await request('/api/activities/start', 'POST', {
    body: { activity: 'Instagram', userId: USER_B },
  });
  assert.equal(startedActivity.status, 400);

  assert.equal(
    (
      await request('/api/activities/start', 'POST', {
        body: { activity: 'Instagram' },
        userId: USER_B,
      })
    ).status,
    201
  );
  assert.equal((await request('/api/activities/stop', 'POST', { userId: USER_B })).status, 200);
  assert.equal((await request('/api/activities', 'GET', { userId: USER_B })).status, 200);
  assert.equal((await request('/api/activities/today', 'GET', { userId: USER_B })).status, 200);

  assert.equal((await request('/api/sessions/start', 'POST', { userId: USER_B })).status, 201);
  assert.equal((await request(`/api/sessions/${SESSION_ID}/pause`, 'PATCH', { userId: USER_B })).status, 200);
  assert.equal((await request(`/api/sessions/${SESSION_ID}/resume`, 'PATCH', { userId: USER_B })).status, 200);
  assert.equal((await request(`/api/sessions/${SESSION_ID}/end`, 'PATCH', { userId: USER_B })).status, 200);
  assert.equal((await request('/api/sessions/active', 'GET', { userId: USER_B })).status, 200);
  assert.equal((await request('/api/sessions', 'GET', { userId: USER_B })).status, 200);

  assert.ok(calls.every(([, userId]) => userId === USER_B));
});

test('malformed session IDs return a client error without reaching MongoDB', async () => {
  const originalFindOne = Session.findOne;
  Session.findOne = () => {
    throw new Error('Database lookup must not run for invalid IDs.');
  };
  try {
    const response = await request('/api/sessions/not-an-id/pause', 'PATCH');
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, 'INVALID_SESSION_ID');
  } finally {
    Session.findOne = originalFindOne;
  }
});

test('activity service calculates elapsed seconds on stop and scopes queries by owner/day', async () => {
  const routeMocks = {
    startActivity: activityService.startActivity,
    stopActivity: activityService.stopActivity,
    getUserActivities: activityService.getUserActivities,
    getTodayActivities: activityService.getTodayActivities,
  };
  Object.assign(activityService, activityServiceMethods);
  originalActivityMethods = {
    findOne: Activity.findOne,
    findOneAndUpdate: Activity.findOneAndUpdate,
    find: Activity.find,
  };
  const ownerId = '65a100000000000000000011';
  const id = '65a100000000000000000012';
  const startedAt = new Date(Date.now() - 4200);
  let stopFilter;
  let stopUpdate;
  let todayFilter;
  let allFilter;
  const document = {
    _id: { toString: () => id },
    user: ownerId,
    activity: 'Instagram',
    startTime: startedAt,
    endTime: null,
    durationSeconds: null,
    date: new Date(Date.UTC(startedAt.getUTCFullYear(), startedAt.getUTCMonth(), startedAt.getUTCDate())),
    createdAt: startedAt,
    updatedAt: startedAt,
  };

  Activity.findOne = (filter) => {
    assert.equal(filter.user, ownerId);
    assert.equal(filter.endTime, null);
    return { sort: async () => document };
  };
  Activity.findOneAndUpdate = async (filter, update) => {
    stopFilter = filter;
    stopUpdate = update;
    return { ...document, ...update.$set };
  };
  Activity.find = (filter) => {
    if (filter.startTime) todayFilter = filter;
    else allFilter = filter;
    return { sort: async () => [] };
  };

  try {
    const activity = await activityService.stopActivity(ownerId);
    assert.ok(activity.durationSeconds >= 4);
    assert.equal(stopFilter.user, ownerId);
    assert.equal(stopFilter.endTime, null);
    assert.ok(stopUpdate.$set.endTime instanceof Date);
    await activityService.getUserActivities(ownerId);
    assert.equal(allFilter.user, ownerId);
    assert.equal(allFilter.startTime, undefined);
    await activityService.getTodayActivities(ownerId);
    assert.equal(todayFilter.user, ownerId);
    assert.ok(todayFilter.startTime.$lt instanceof Date);
    assert.ok(todayFilter.$or[1].endTime.$gte instanceof Date);
    assert.equal(
      todayFilter.startTime.$lt.getTime() - todayFilter.$or[1].endTime.$gte.getTime(),
      86400000
    );
  } finally {
    Activity.findOne = originalActivityMethods.findOne;
    Activity.findOneAndUpdate = originalActivityMethods.findOneAndUpdate;
    Activity.find = originalActivityMethods.find;
    originalActivityMethods = null;
    Object.assign(activityService, routeMocks);
  }
});

test('session pause/resume duration excludes paused time and validates transitions', async () => {
  const routeMocks = {
    startSession: sessionService.startSession,
    pauseSession: sessionService.pauseSession,
    resumeSession: sessionService.resumeSession,
    endSession: sessionService.endSession,
    getSessions: sessionService.getSessions,
    getActiveSession: sessionService.getActiveSession,
  };
  Object.assign(sessionService, sessionServiceMethods);
  originalSessionMethods = { findOne: Session.findOne };
  const ownerId = '65a100000000000000000021';
  const id = '65a100000000000000000022';
  const startedAt = new Date(Date.now() - 8000);
  const session = {
    _id: { toString: () => id },
    user: ownerId,
    startTime: startedAt,
    endTime: null,
    status: 'active',
    lastResumedAt: startedAt,
    pauseHistory: [],
    durationSeconds: 0,
    createdAt: startedAt,
    updatedAt: startedAt,
    save: async () => {},
  };
  Session.findOne = async (filter) => {
    assert.equal(filter.user, ownerId);
    assert.equal(filter._id, id);
    return session;
  };

  try {
    await assert.rejects(
      sessionService.resumeSession(ownerId, id),
      (error) => error.statusCode === 409 && error.code === 'INVALID_SESSION_STATE'
    );
    const paused = await sessionService.pauseSession(ownerId, id);
    assert.equal(paused.status, 'paused');
    const activeDurationAtPause = paused.durationSeconds;
    assert.ok(activeDurationAtPause >= 7);
    await assert.rejects(
      sessionService.pauseSession(ownerId, id),
      (error) => error.statusCode === 409 && error.code === 'INVALID_SESSION_STATE'
    );

    const pauseEntry = session.pauseHistory[0];
    pauseEntry.startTime = new Date(Date.now() - 20000);
    const resumed = await sessionService.resumeSession(ownerId, id);
    assert.equal(resumed.status, 'active');
    assert.ok(pauseEntry.durationSeconds >= 19);
    assert.equal(session.durationSeconds, activeDurationAtPause);

    session.lastResumedAt = new Date(Date.now() - 3000);
    const completed = await sessionService.endSession(ownerId, id);
    assert.equal(completed.status, 'completed');
    assert.ok(completed.durationSeconds >= activeDurationAtPause + 2);
    assert.ok(completed.durationSeconds < 15);
    assert.ok(completed.endTime instanceof Date);
    assert.equal(session.activeOwner, undefined);

    await assert.rejects(
      sessionService.resumeSession(ownerId, id),
      (error) => error.statusCode === 409 && error.code === 'INVALID_SESSION_STATE'
    );
  } finally {
    Session.findOne = originalSessionMethods.findOne;
    originalSessionMethods = null;
    Object.assign(sessionService, routeMocks);
  }
});

test('a paused session may end without adding paused time to active duration', async () => {
  const routeMocks = {
    startSession: sessionService.startSession,
    pauseSession: sessionService.pauseSession,
    resumeSession: sessionService.resumeSession,
    endSession: sessionService.endSession,
    getSessions: sessionService.getSessions,
    getActiveSession: sessionService.getActiveSession,
  };
  Object.assign(sessionService, sessionServiceMethods);
  const originalFindOne = Session.findOne;
  const ownerId = '65a100000000000000000031';
  const id = '65a100000000000000000032';
  const pausedAt = new Date(Date.now() - 20000);
  const session = {
    _id: { toString: () => id },
    user: ownerId,
    startTime: new Date(Date.now() - 40000),
    endTime: null,
    status: 'paused',
    lastResumedAt: null,
    pauseHistory: [{ startTime: pausedAt, endTime: null, durationSeconds: 0 }],
    durationSeconds: 12,
    createdAt: pausedAt,
    updatedAt: pausedAt,
    save: async () => {},
  };
  Session.findOne = async (filter) => {
    assert.equal(filter.user, ownerId);
    assert.equal(filter._id, id);
    return session;
  };

  try {
    const ended = await sessionService.endSession(ownerId, id);
    assert.equal(ended.status, 'completed');
    assert.equal(ended.durationSeconds, 12);
    assert.ok(ended.endTime instanceof Date);
    assert.ok(ended.pauseHistory[0].durationSeconds >= 20);
    await assert.rejects(
      sessionService.pauseSession(ownerId, id),
      (error) => error.statusCode === 409 && error.code === 'INVALID_SESSION_STATE'
    );
  } finally {
    Session.findOne = originalFindOne;
    Object.assign(sessionService, routeMocks);
  }
});
