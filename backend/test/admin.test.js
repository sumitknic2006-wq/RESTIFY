process.env.JWT_SECRET = 'test-only-secret-that-is-at-least-32-bytes';

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const app = require('../src/app');
const User = require('../src/models/User');
const Session = require('../src/models/Session');
const authService = require('../src/services/authService');
const adminService = require('../src/services/adminService');
const authRegistration = require('../src/services/authService');
const { generateToken } = require('../src/utils/jwt');

const ADMIN_ID = '507f1f77bcf86cd799439011';
const USER_ID = '507f1f77bcf86cd799439012';
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

function get(path, id = USER_ID) {
  return fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${generateToken(id)}` },
  });
}

test('all admin APIs require authentication and server-verified admin role', async () => {
  const originalGetCurrentUser = authService.getCurrentUser;
  const originalGetOverview = adminService.getOverview;
  const originalGetUsers = adminService.getUsers;
  authService.getCurrentUser = async (id) => ({
    id,
    name: 'Account',
    email: 'account@example.com',
    role: id === ADMIN_ID ? 'admin' : 'user',
  });
  adminService.getOverview = async () => ({ registeredUsers: 2 });
  adminService.getUsers = async () => ({ users: [], pagination: { page: 1, limit: 25, total: 0, pages: 0 } });
  try {
    assert.equal((await fetch(`${baseUrl}/api/admin/overview`)).status, 401);
    assert.equal((await fetch(`${baseUrl}/api/admin/overview`, {
      headers: { Authorization: 'Bearer invalid-token' },
    })).status, 401);
    assert.equal((await get('/api/admin/overview')).status, 403);
    assert.equal((await get('/api/admin/users', USER_ID)).status, 403);

    const overview = await get('/api/admin/overview', ADMIN_ID);
    assert.equal(overview.status, 200);
    assert.equal((await overview.json()).data.overview.registeredUsers, 2);
    assert.equal((await get('/api/admin/users', ADMIN_ID)).status, 200);
  } finally {
    authService.getCurrentUser = originalGetCurrentUser;
    adminService.getOverview = originalGetOverview;
    adminService.getUsers = originalGetUsers;
  }
});

test('admin user query validates filters, escapes search, paginates, and omits private fields', async () => {
  const originalFind = User.find;
  const originalCountDocuments = User.countDocuments;
  let filter;
  let selected;
  let skipped;
  User.countDocuments = async (query) => {
    filter = query;
    return 26;
  };
  User.find = (query) => {
    filter = query;
    const chain = {
      select(fields) { selected = fields; return this; },
      sort() { return this; },
      skip(value) { skipped = value; return this; },
      limit() { return this; },
      lean: async () => [{
        _id: { toString: () => USER_ID },
        name: 'Person',
        email: 'person@example.com',
        role: 'user',
        createdAt: new Date('2025-01-01T00:00:00Z'),
        password: 'not-selected',
        preferences: { theme: 'dark' },
      }],
    };
    return chain;
  };
  try {
    const result = await adminService.getUsers({
      page: '2',
      limit: '25',
      search: 'x.*@example.com',
      role: 'user',
    });
    assert.equal(filter.role, 'user');
    assert.equal(filter.$or[1].email.$regex, 'x\\.\\*@example\\.com');
    assert.equal(selected, 'name email role createdAt');
    assert.equal(skipped, 25);
    assert.equal(result.pagination.total, 26);
    assert.equal(result.pagination.pages, 2);
    assert.deepEqual(Object.keys(result.users[0]).sort(), ['createdAt', 'email', 'id', 'name', 'role']);
    await assert.rejects(
      adminService.getUsers({ role: 'superadmin' }),
      (error) => error.code === 'VALIDATION_ERROR'
    );
    await assert.rejects(
      adminService.getUsers({ unsupported: 'password' }),
      (error) => error.code === 'VALIDATION_ERROR'
    );
  } finally {
    User.find = originalFind;
    User.countDocuments = originalCountDocuments;
  }
});

test('admin overview uses bounded server-side aggregation and returns zero-safe real metrics', async () => {
  const originalCountDocuments = User.countDocuments;
  const originalAggregate = Session.aggregate;
  let pipelines = [];
  User.countDocuments = async (filter) => {
    assert.deepEqual(filter, {});
    return 8;
  };
  Session.aggregate = async (pipeline) => {
    pipelines.push(pipeline);
    return pipelines.length === 1
      ? [{ completedCount: 3, recordedDurationSeconds: 5400, focusCount: 2 }]
      : [{ _id: '2025-01-15', completedCount: 3, recordedDurationSeconds: 5400 }];
  };
  try {
    const now = new Date('2025-01-15T12:00:00Z');
    const overview = await adminService.getOverview({ days: '7' }, now);
    assert.equal(overview.registeredUsers, 8);
    assert.deepEqual(overview.sessions, {
      completedCount: 3,
      recordedDurationSeconds: 5400,
      focusCount: 2,
      daily: [{ date: '2025-01-15', completedCount: 3, recordedDurationSeconds: 5400 }],
    });
    assert.equal(pipelines.length, 2);
    assert.ok(pipelines.every((pipeline) => pipeline[0].$match.status === 'completed'));
    assert.ok(pipelines.every((pipeline) => pipeline[0].$match.endTime.$gte instanceof Date));
    await assert.rejects(
      adminService.getOverview({ days: '365' }, now),
      (error) => error.code === 'VALIDATION_ERROR'
    );
  } finally {
    User.countDocuments = originalCountDocuments;
    Session.aggregate = originalAggregate;
  }
});

test('registration ignores client-supplied admin role and returns ordinary role', async () => {
  const originalFindOne = User.findOne;
  const originalCreate = User.create;
  let createValues;
  User.findOne = () => ({ select: async () => null });
  User.create = async (values) => {
    createValues = values;
    return { ...values, id: USER_ID, _id: USER_ID, role: 'user' };
  };
  try {
    const result = await authRegistration.register({
      name: 'New Account',
      email: 'new@example.com',
      password: 'strongPass123',
      role: 'admin',
    });
    assert.equal(Object.hasOwn(createValues, 'role'), false);
    assert.equal(result.user.role, 'user');
  } finally {
    User.findOne = originalFindOne;
    User.create = originalCreate;
  }
});
