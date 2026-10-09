process.env.JWT_SECRET = 'analytics-test-secret-that-is-at-least-32-bytes';

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const app = require('../src/app');
const Activity = require('../src/models/Activity');
const Session = require('../src/models/Session');
const authService = require('../src/services/authService');
const analyticsService = require('../src/services/analyticsService');
const env = require('../src/config/env');
const { generateToken } = require('../src/utils/jwt');
const createAppError = require('../src/utils/appError');

const OWNER_ID = '65a700000000000000000001';
const OTHER_ID = '65a700000000000000000002';

let server;
let baseUrl;
let originalAuth;
let originalActivityFind;
let originalSessionFind;
let originalToday;
let fakeActivities = [];
let fakeSessions = [];
const queryOwners = [];

before(async () => {
  originalAuth = authService.getCurrentUser;
  originalActivityFind = Activity.find;
  originalSessionFind = Session.find;
  originalToday = analyticsService.getTodayAnalytics;

  authService.getCurrentUser = async (id) => {
    if (![OWNER_ID, OTHER_ID].includes(id)) {
      throw createAppError(401, 'Authentication required.', 'UNAUTHORIZED');
    }
    return { id, name: 'Analytics Test User', email: 'analytics@example.com' };
  };
  Activity.find = (filter) => {
    queryOwners.push(filter.user.toString());
    const selected = fakeActivities.filter((record) => filter.user.toString() === OWNER_ID);
    return { select: async () => selected };
  };
  Session.find = (filter) => {
    queryOwners.push(filter.user.toString());
    const selected = fakeSessions.filter((record) => filter.user.toString() === OWNER_ID);
    return { select: async () => selected };
  };

  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  authService.getCurrentUser = originalAuth;
  Activity.find = originalActivityFind;
  Session.find = originalSessionFind;
  analyticsService.getTodayAnalytics = originalToday;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

function activity(startTime, endTime, name = 'YouTube', target = null) {
  return { startTime: new Date(startTime), endTime: new Date(endTime), activity: name, target };
}

function session(startTime, endTime, overrides = {}) {
  return {
    startTime: new Date(startTime),
    endTime: new Date(endTime),
    status: 'completed',
    lastResumedAt: null,
    pauseHistory: [],
    ...overrides,
  };
}

async function request(path, userId = OWNER_ID) {
  return fetch(`${baseUrl}/api/analytics${path}`, {
    headers: { Authorization: `Bearer ${generateToken(userId)}` },
  });
}

test('analytics endpoints require authentication and use only the verified owner', async () => {
  const paths = ['/today', '/weekly', '/monthly', '/ranking', '/heatmap'];
  for (const path of paths) {
    assert.equal((await fetch(`${baseUrl}/api/analytics${path}`)).status, 401);
  }

  queryOwners.length = 0;
  for (const path of paths) {
    const response = await request(path, OTHER_ID);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.success, true);
    if (path === '/today' || path === '/weekly' || path === '/monthly') {
      assert.equal(payload.data.analytics.totalDurationSeconds, 0);
    }
  }
  assert.deepEqual(queryOwners, paths.flatMap(() => [OTHER_ID, OTHER_ID]));
});

test('CORS allows the configured production origin and required API preflight headers', async () => {
  const originalNodeEnv = env.NODE_ENV;
  const originalClientUrl = env.CLIENT_URL;
  env.NODE_ENV = 'production';
  env.CLIENT_URL = 'http://localhost:5173';

  try {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://restify-6no6.vercel.app',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization,content-type',
      },
    });
    assert.equal(response.status, 204);
    assert.equal(
      response.headers.get('access-control-allow-origin'),
      'https://restify-6no6.vercel.app'
    );
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
    assert.match(response.headers.get('access-control-allow-methods'), /\bPOST\b/);
    assert.match(response.headers.get('access-control-allow-headers'), /Authorization/i);
    assert.match(response.headers.get('access-control-allow-headers'), /Content-Type/i);

    const denied = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'http://localhost:5173' },
    });
    assert.equal(denied.headers.get('access-control-allow-origin'), null);
    const untrusted = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'https://untrusted.example' },
    });
    assert.equal(untrusted.headers.get('access-control-allow-origin'), null);
  } finally {
    env.NODE_ENV = originalNodeEnv;
    env.CLIENT_URL = originalClientUrl;
  }
});

test('development CORS allows local Vite and preview origins', async () => {
  const originalNodeEnv = env.NODE_ENV;
  const originalClientUrl = env.CLIENT_URL;
  env.NODE_ENV = 'development';
  env.CLIENT_URL = 'http://localhost:5173';

  try {
    for (const origin of ['http://localhost:5173', 'http://localhost:5174']) {
      const response = await fetch(`${baseUrl}/api/health`, {
        headers: { Origin: origin },
      });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('access-control-allow-origin'), origin);
    }
  } finally {
    env.NODE_ENV = originalNodeEnv;
    env.CLIENT_URL = originalClientUrl;
  }
});

test('today includes actual activities, session-only time, and removes overlapping session time', async () => {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  fakeActivities = [activity(start.getTime() + 1000, start.getTime() + 11000, 'YouTube')];
  fakeSessions = [
    session(start.getTime(), start.getTime() + 21000),
    session(start.getTime() + 30000, start.getTime() + 35000),
  ];

  const result = await analyticsService.getTodayAnalytics(OWNER_ID);
  assert.equal(result.totalDurationSeconds, 26);
  assert.equal(result.activities.find((entry) => entry.activity === 'YouTube').durationSeconds, 10);
  assert.equal(
    result.activities.find((entry) => entry.activity === 'Unattributed session').durationSeconds,
    16
  );
  assert.equal(result.today.date, start.toISOString().slice(0, 10));
});

test('weekly and monthly periods use UTC bounds and produce actual daily totals', async () => {
  fakeActivities = [];
  fakeSessions = [];
  const now = new Date('2025-02-12T12:00:00Z');
  const result = await analyticsService.getAnalytics(OWNER_ID, 'weekly', now);
  assert.equal(result.period.timezone, 'UTC');
  assert.equal(result.period.start, '2025-02-10T00:00:00.000Z');
  assert.equal(result.period.end, '2025-02-17T00:00:00.000Z');
  assert.equal(result.days.length, 7);
  assert.ok(result.days.every((day) => day.totalDurationSeconds === 0));

  const monthly = await analyticsService.getAnalytics(OWNER_ID, 'monthly', now);
  assert.equal(monthly.period.start, '2025-02-01T00:00:00.000Z');
  assert.equal(monthly.period.end, '2025-03-01T00:00:00.000Z');
  assert.equal(monthly.days.length, 28);
});

test('paused sessions exclude paused duration and completed sessions stop at endTime', async () => {
  const now = new Date('2025-02-12T12:00:00Z');
  const dayStart = new Date('2025-02-12T00:00:00Z');
  fakeActivities = [];
  fakeSessions = [
    session(dayStart, new Date('2025-02-12T00:00:30Z'), {
      pauseHistory: [
        { startTime: new Date('2025-02-12T00:00:10Z'), endTime: new Date('2025-02-12T00:00:20Z') },
      ],
    }),
  ];
  const result = await analyticsService.getAnalytics(OWNER_ID, 'today', now);
  assert.equal(result.totalDurationSeconds, 20);
});

test('rule-linked session time keeps its configured activity and target in analytics', async () => {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  fakeActivities = [];
  fakeSessions = [
    session(start.getTime() + 1000, start.getTime() + 11000, {
      ruleSnapshot: { activity: 'Custom Website', target: 'example.com' },
    }),
  ];

  const result = await analyticsService.getTodayAnalytics(OWNER_ID, now);
  assert.equal(result.totalDurationSeconds, 10);
  assert.equal(result.activities[0].activity, 'Custom Website');
  assert.equal(result.activities[0].target, 'example.com');
});

test('ranking and heatmap are derived from records and include empty periods without fake duration', async () => {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  fakeActivities = [
    activity(start.getTime() + 1000, start.getTime() + 5000, 'Instagram'),
    activity(start.getTime() + 6000, start.getTime() + 16000, 'YouTube'),
  ];
  fakeSessions = [];
  const ranking = await analyticsService.getActivityRanking(OWNER_ID);
  assert.equal(ranking.ranking[0].activity, 'YouTube');
  assert.equal(ranking.ranking[0].rank, 1);

  const heatmap = await analyticsService.getHeatmap(OWNER_ID);
  assert.equal(heatmap.cells.length, 30);
  assert.equal(heatmap.cells.at(-1).durationSeconds, 14);
  assert.ok(heatmap.cells.slice(0, -1).every((cell) => cell.durationSeconds === 0));
});
