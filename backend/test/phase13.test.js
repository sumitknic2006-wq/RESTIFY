process.env.JWT_SECRET = 'test-only-secret-that-is-at-least-32-bytes';

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const app = require('../src/app');
const User = require('../src/models/User');
const Notification = require('../src/models/Notification');
const Activity = require('../src/models/Activity');
const Session = require('../src/models/Session');
const authService = require('../src/services/authService');
const userService = require('../src/services/userService');
const notificationService = require('../src/services/notificationService');
const challengeService = require('../src/services/challengeService');
const { generateToken } = require('../src/utils/jwt');
const { validatePreferences } = require('../src/validators/userPreferencesValidator');

const OWNER_ID = '507f1f77bcf86cd799439011';
let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

async function request(path, { method = 'GET', body, authenticated = true } = {}) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(authenticated ? { Authorization: `Bearer ${generateToken(OWNER_ID)}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

test('preference validation accepts partial settings and rejects unknown or malformed fields', () => {
  assert.deepEqual(validatePreferences({ theme: 'dark' }), []);
  assert.deepEqual(validatePreferences({ notifications: { goals: false } }), []);
  assert.ok(validatePreferences({ theme: 'auto' }).some((error) => error.field === 'theme'));
  assert.ok(validatePreferences({ notifications: { goals: 'no' } }).some((error) => error.field === 'notifications.goals'));
  assert.ok(validatePreferences({ isAdmin: true }).some((error) => error.field === 'isAdmin'));
});

test('profile preferences endpoint is authenticated and validates before persistence', async () => {
  const originalGetUser = authService.getCurrentUser;
  const originalUpdate = userService.updatePreferences;
  const updates = [];
  authService.getCurrentUser = async (id) => ({ id, name: 'User', email: 'user@example.com' });
  userService.updatePreferences = async (id, input) => {
    updates.push({ id, input });
    return { theme: input.theme || 'system', notifications: { achievements: true, challenges: true, goals: false } };
  };
  try {
    const unauthorized = await request('/api/users/me/preferences', {
      method: 'PATCH',
      body: { theme: 'dark' },
      authenticated: false,
    });
    assert.equal(unauthorized.status, 401);
    const invalid = await request('/api/users/me/preferences', {
      method: 'PATCH',
      body: { theme: 'auto' },
    });
    assert.equal(invalid.status, 400);
    assert.equal(updates.length, 0);
    const saved = await request('/api/users/me/preferences', {
      method: 'PATCH',
      body: { theme: 'light', notifications: { goals: false } },
    });
    const payload = await saved.json();
    assert.equal(saved.status, 200);
    assert.equal(updates[0].id, OWNER_ID);
    assert.equal(payload.data.preferences.theme, 'light');
  } finally {
    authService.getCurrentUser = originalGetUser;
    userService.updatePreferences = originalUpdate;
  }
});

test('notification endpoints enforce authentication and restrict mutations to the token owner', async () => {
  const originalGetUser = authService.getCurrentUser;
  const originals = {
    list: notificationService.listForUser,
    markRead: notificationService.markRead,
    markAllRead: notificationService.markAllRead,
    dismiss: notificationService.dismiss,
  };
  const calls = [];
  authService.getCurrentUser = async (id) => ({ id, name: 'User', email: 'user@example.com' });
  notificationService.listForUser = async (id) => {
    calls.push(['list', id]);
    return { notifications: [{ id: 'n1', readAt: null, createdAt: new Date() }], unreadCount: 1 };
  };
  notificationService.markRead = async (userId, id) => {
    calls.push(['read', userId, id]);
    return { id, readAt: new Date() };
  };
  notificationService.markAllRead = async (id) => {
    calls.push(['read-all', id]);
    return { updatedCount: 1 };
  };
  notificationService.dismiss = async (userId, id) => {
    calls.push(['dismiss', userId, id]);
    return { id };
  };
  try {
    assert.equal((await request('/api/notifications', { authenticated: false })).status, 401);
    const list = await request('/api/notifications');
    assert.equal(list.status, 200);
    assert.equal((await list.json()).data.unreadCount, 1);
    assert.equal((await request('/api/notifications/n1/read', { method: 'PATCH' })).status, 200);
    assert.equal((await request('/api/notifications/read-all', { method: 'PATCH' })).status, 200);
    assert.equal((await request('/api/notifications/n1', { method: 'DELETE' })).status, 200);
    assert.ok(calls.every((call) => call[1] === OWNER_ID));
  } finally {
    authService.getCurrentUser = originalGetUser;
    notificationService.listForUser = originals.list;
    notificationService.markRead = originals.markRead;
    notificationService.markAllRead = originals.markAllRead;
    notificationService.dismiss = originals.dismiss;
  }
});

test('preference updates merge notification categories and notification persistence is deduplicated per user/source', async () => {
  const originalFindById = User.findById;
  const originalFindOneAndUpdate = Notification.findOneAndUpdate;
  const originalFindOne = Notification.findOne;
  const savedWrites = [];
  const user = {
    preferences: { theme: 'dark', notifications: { achievements: true, challenges: false, goals: true } },
    async select() { return this; },
    async save() {},
  };
  User.findById = () => user;
  Notification.findOneAndUpdate = async (filter, update, options) => {
    savedWrites.push({ filter, update, options });
    return { _id: { toString: () => 'n1' }, category: 'goals', title: 'Goal reached', message: 'Reached target', readAt: null, createdAt: new Date() };
  };
  Notification.findOne = async () => null;
  try {
    const preferences = await userService.updatePreferences(OWNER_ID, { notifications: { challenges: true } });
    assert.equal(preferences.theme, 'dark');
    assert.deepEqual(preferences.notifications, { achievements: true, challenges: true, goals: true });
    await notificationService.createForUser(OWNER_ID, {
      category: 'goals',
      sourceKey: 'goal:g1:2025-01-01:limit-reached',
      title: 'Goal reached',
      message: 'Reached target',
    });
    assert.deepEqual(savedWrites[0].filter, { user: OWNER_ID, sourceKey: 'goal:g1:2025-01-01:limit-reached' });
    assert.equal(savedWrites[0].options.upsert, true);
    assert.equal(savedWrites[0].update.$setOnInsert.title, 'Goal reached');
  } finally {
    User.findById = originalFindById;
    Notification.findOneAndUpdate = originalFindOneAndUpdate;
    Notification.findOne = originalFindOne;
  }
});

test('notification preferences suppress opted-out events and unread count includes records beyond the list limit', async () => {
  const originals = {
    findById: User.findById,
    find: Notification.find,
    countDocuments: Notification.countDocuments,
    findOneAndUpdate: Notification.findOneAndUpdate,
  };
  let writeCount = 0;
  const optedOutUser = {
    preferences: { notifications: { achievements: false, challenges: true, goals: true } },
    async select() { return this; },
  };
  User.findById = () => optedOutUser;
  Notification.find = () => ({
    sort(sort) {
      assert.deepEqual(sort, { createdAt: -1, _id: -1 });
      return this;
    },
    limit(limit) {
      assert.equal(limit, 100);
      return Promise.resolve([]);
    },
  });

  Notification.countDocuments = async (filter) => {
    assert.deepEqual(filter, { user: OWNER_ID, dismissedAt: null, readAt: null });
    return 104;
  };
  Notification.findOneAndUpdate = async () => {
    writeCount += 1;
  };
  try {
    const suppressed = await notificationService.createForUser(OWNER_ID, {
      category: 'achievements',
      sourceKey: 'achievement:test',
      title: 'Achievement',
      message: 'Unlocked',
    });
    assert.equal(suppressed, null);
    assert.equal(writeCount, 0);
    const result = await notificationService.listForUser(OWNER_ID);
    assert.equal(result.notifications.length, 0);
    assert.equal(result.unreadCount, 104);
  } finally {
    User.findById = originals.findById;
    Notification.find = originals.find;
    Notification.countDocuments = originals.countDocuments;
    Notification.findOneAndUpdate = originals.findOneAndUpdate;
  }
});

test('verified daily challenge completion creates one source-keyed in-app notification', async () => {
  const DailyChallenge = require('../src/models/DailyChallenge');
  const originals = {
    findChallenge: DailyChallenge.findOne,
    updateChallenge: DailyChallenge.updateOne,
    findActivity: Activity.findOne,
    findSession: Session.findOne,
    createNotification: notificationService.createForUser,
  };
  const completedAt = new Date('2025-02-12T12:00:00Z');
  let storedChallenge = null;
  let notification;
  DailyChallenge.findOne = async () => storedChallenge;
  DailyChallenge.updateOne = async (_filter, update) => {
    storedChallenge = { ...update.$setOnInsert };
    return { upsertedCount: 1 };
  };
  Activity.findOne = () => ({ select: async () => ({ _id: 'tracked' }) });
  Session.findOne = () => ({ select: async () => null });
  notificationService.createForUser = async (userId, details) => {
    notification = { userId, ...details };
  };
  try {
    const result = await challengeService.completeTodayChallenge(OWNER_ID, completedAt);
    assert.equal(result.completed, true);
    assert.equal(notification.userId, OWNER_ID);
    assert.equal(notification.category, 'challenges');
    assert.equal(notification.sourceKey, 'challenge:track-screen-time:2025-02-12');
  } finally {
    DailyChallenge.findOne = originals.findChallenge;
    DailyChallenge.updateOne = originals.updateChallenge;
    Activity.findOne = originals.findActivity;
    Session.findOne = originals.findSession;
    notificationService.createForUser = originals.createNotification;
  }
});

test('notification read and dismiss mutations always include the authenticated owner', async () => {
  const originalFindOneAndUpdate = Notification.findOneAndUpdate;
  const queries = [];
  Notification.findOneAndUpdate = async (filter, update) => {
    queries.push({ filter, update });
    return {
      _id: { toString: () => filter._id },
      category: 'achievements',
      title: 'Unlocked',
      message: 'Achievement unlocked',
      readAt: update.$set.readAt || null,
      createdAt: new Date(),
    };
  };
  try {
    await assert.rejects(
      notificationService.markRead(OWNER_ID, 'not-an-object-id'),
      (error) => error.code === 'INVALID_NOTIFICATION_ID'
    );
    await notificationService.markRead(OWNER_ID, '507f1f77bcf86cd799439012');
    await notificationService.dismiss(OWNER_ID, '507f1f77bcf86cd799439013');
    assert.ok(queries.every(({ filter }) => filter.user === OWNER_ID && filter.dismissedAt === null));
    assert.ok(queries[0].update.$set.readAt instanceof Date);
    assert.ok(queries[1].update.$set.dismissedAt instanceof Date);
  } finally {
    Notification.findOneAndUpdate = originalFindOneAndUpdate;
  }
});
