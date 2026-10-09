process.env.JWT_SECRET = 'rule-test-secret-that-is-at-least-32-bytes';

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const mongoose = require('mongoose');
const app = require('../src/app');
const authService = require('../src/services/authService');
const ruleService = require('../src/services/ruleService');
const Rule = require('../src/models/Rule');
const { generateToken } = require('../src/utils/jwt');
const {
  prepareRuleInput,
  validateRuleCreate,
  validateRuleUpdate,
} = require('../src/validators/ruleValidator');
const createAppError = require('../src/utils/appError');

const OWNER_ID = '65a000000000000000000001';
const SECOND_OWNER_ID = '65a000000000000000000002';
const RULE_ID = '65a000000000000000000003';
const validRule = {
  activity: 'Instagram',
  timeLimit: 30,
  action: 'blur',
  message: 'Take a break.',
  restDuration: 5,
};

let server;
let baseUrl;
let originalAuthService;
let originals;
const calls = [];

before(async () => {
  originalAuthService = authService.getCurrentUser;
  authService.getCurrentUser = async (id) => {
    if (id !== OWNER_ID && id !== SECOND_OWNER_ID) {
      throw createAppError(401, 'Authentication required.', 'UNAUTHORIZED');
    }
    return { id, name: 'Rule Test User', email: 'test@example.com' };
  };

  originals = {
    createRule: ruleService.createRule,
    getUserRules: ruleService.getUserRules,
    getRuleById: ruleService.getRuleById,
    updateRule: ruleService.updateRule,
    deleteRule: ruleService.deleteRule,
    toggleRule: ruleService.toggleRule,
  };

  ruleService.createRule = async (userId, input) => {
    calls.push(['create', userId, input]);
    return { id: RULE_ID, ...input, enabled: input.enabled ?? true };
  };
  ruleService.getUserRules = async (userId) => {
    calls.push(['list', userId]);
    return [{ id: RULE_ID, ...validRule, enabled: true }];
  };
  ruleService.getRuleById = async (userId, ruleId) => {
    calls.push(['get', userId, ruleId]);
    if (ruleId === '65a000000000000000000099') {
      throw createAppError(404, 'Rule not found.', 'RULE_NOT_FOUND');
    }
    return { id: ruleId, ...validRule, enabled: true };
  };
  ruleService.updateRule = async (userId, ruleId, input) => {
    calls.push(['update', userId, ruleId, input]);
    return { id: ruleId, ...validRule, ...input, enabled: input.enabled ?? true };
  };
  ruleService.deleteRule = async (userId, ruleId) => {
    calls.push(['delete', userId, ruleId]);
    return { id: ruleId };
  };
  ruleService.toggleRule = async (userId, ruleId) => {
    calls.push(['toggle', userId, ruleId]);
    return { id: ruleId, ...validRule, enabled: false };
  };

  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  authService.getCurrentUser = originalAuthService;
  Object.assign(ruleService, originals);
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

async function request(path, method, { body, userId = OWNER_ID } = {}) {
  return fetch(`${baseUrl}/api/rules${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      Authorization: `Bearer ${generateToken(userId)}`,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

test('Rule validation supports customizable values and website targets', () => {
  assert.deepEqual(validateRuleCreate(validRule), []);

  const customTarget = prepareRuleInput({
    ...validRule,
    activity: 'Custom Website',
    target: 'Example.com',
    timeLimit: 45,
    restDuration: 10,
    action: 'Fullscreen Reminder',
  });
  assert.deepEqual(customTarget.errors, []);
  assert.equal(customTarget.value.activity, 'Custom Website');
  assert.equal(customTarget.value.target, 'example.com');
  assert.equal(customTarget.value.action, 'fullscreen_reminder');

  const domainAsActivity = prepareRuleInput({ ...validRule, activity: 'youtube.com' });
  assert.deepEqual(domainAsActivity.errors, []);
  assert.equal(domainAsActivity.value.activity, 'Custom Website');
  assert.equal(domainAsActivity.value.target, 'youtube.com');

  assert.ok(validateRuleCreate({ ...validRule, timeLimit: 0 }).some((error) => error.field === 'timeLimit'));
  assert.ok(
    validateRuleCreate({ ...validRule, action: 'launch native app' }).some(
      (error) => error.field === 'action'
    )
  );
  assert.ok(
    validateRuleCreate({ ...validRule, activity: 'Custom Website' }).some(
      (error) => error.field === 'target'
    )
  );
  assert.ok(
    validateRuleCreate({
      ...validRule,
      activity: 'Custom Website',
      target: 'https://example.com/path',
    }).some((error) => error.field === 'target')
  );
  assert.ok(validateRuleUpdate({ user: OWNER_ID }).some((error) => error.field === 'user'));
  assert.deepEqual(validateRuleUpdate({ timeLimit: 120 }), []);
});

test('all Rule APIs require authentication and scope calls to JWT user identity', async () => {
  calls.length = 0;
  const unauthenticated = await fetch(`${baseUrl}/api/rules`);
  assert.equal(unauthenticated.status, 401);

  const created = await request('', 'POST', {
    body: { ...validRule, timeLimit: 120, restDuration: 10 },
  });
  assert.equal(created.status, 201);
  assert.equal((await created.json()).data.rule.timeLimit, 120);

  const listed = await request('', 'GET', { userId: SECOND_OWNER_ID });
  assert.equal(listed.status, 200);

  const got = await request(`/${RULE_ID}`, 'GET');
  assert.equal(got.status, 200);

  const updated = await request(`/${RULE_ID}`, 'PUT', {
    body: { timeLimit: 60, action: 'warning', message: 'Stop scrolling.', restDuration: 15 },
  });
  assert.equal(updated.status, 200);

  const toggled = await request(`/${RULE_ID}/toggle`, 'PATCH');
  assert.equal(toggled.status, 200);
  assert.equal((await toggled.json()).data.rule.enabled, false);

  const deleted = await request(`/${RULE_ID}`, 'DELETE');
  assert.equal(deleted.status, 200);

  assert.deepEqual(
    calls.map(([operation, userId]) => [operation, userId]),
    [
      ['create', OWNER_ID],
      ['list', SECOND_OWNER_ID],
      ['get', OWNER_ID],
      ['update', OWNER_ID],
      ['toggle', OWNER_ID],
      ['delete', OWNER_ID],
    ]
  );
});

test('Rule endpoints reject invalid IDs, invalid bodies, and unknown rule ownership safely', async () => {
  const invalidId = await request('/not-an-object-id', 'GET');
  assert.equal(invalidId.status, 400);
  assert.equal((await invalidId.json()).code, 'INVALID_RULE_ID');

  const invalidRule = await request('', 'POST', {
    body: { ...validRule, timeLimit: -1 },
  });
  assert.equal(invalidRule.status, 400);

  const spoofedOwner = await request('', 'POST', {
    body: { ...validRule, user: SECOND_OWNER_ID },
  });
  assert.equal(spoofedOwner.status, 400);

  const missingRule = await request('/65a000000000000000000099', 'GET');
  assert.equal(missingRule.status, 404);
  assert.equal((await missingRule.json()).message, 'Rule not found.');
});

test('Rule service always scopes list and mutations to the authenticated owner', async () => {
  const activeServiceMocks = {
    createRule: ruleService.createRule,
    getUserRules: ruleService.getUserRules,
    getRuleById: ruleService.getRuleById,
    updateRule: ruleService.updateRule,
    deleteRule: ruleService.deleteRule,
    toggleRule: ruleService.toggleRule,
  };
  const originalsForService = {
    create: Rule.create,
    find: Rule.find,
    findOne: Rule.findOne,
    findOneAndDelete: Rule.findOneAndDelete,
  };
  const filters = [];
  const validId = new mongoose.Types.ObjectId().toString();
  const makeDocument = (overrides = {}) => ({
    _id: new mongoose.Types.ObjectId(validId),
    activity: 'Instagram',
    target: undefined,
    timeLimit: 30,
    action: 'blur',
    message: 'Take a break.',
    restDuration: 5,
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
    save: async function save() {
      return this;
    },
  });

  try {
    Object.assign(ruleService, originals);
    Rule.create = async (values) => {
      assert.equal(values.user, OWNER_ID);
      return makeDocument(values);
    };
    Rule.find = (filter) => {
      filters.push(filter);
      return { sort: async () => [makeDocument()] };
    };
    Rule.findOne = async (filter) => {
      filters.push(filter);
      return makeDocument();
    };
    Rule.findOneAndDelete = async (filter) => {
      filters.push(filter);
      return makeDocument();
    };

    const created = await ruleService.createRule(OWNER_ID, {
      ...validRule,
      activity: 'YouTube',
      timeLimit: 45,
      restDuration: 10,
    });
    assert.equal(created.timeLimit, 45);

    const listed = await ruleService.getUserRules(OWNER_ID);
    assert.equal(listed.length, 1);
    assert.equal(filters[0].user, OWNER_ID);

    await ruleService.getRuleById(OWNER_ID, validId);
    await ruleService.updateRule(OWNER_ID, validId, { timeLimit: 90 });
    await ruleService.toggleRule(OWNER_ID, validId);
    await ruleService.deleteRule(OWNER_ID, validId);

    for (const filter of filters.slice(1)) {
      assert.equal(filter._id, validId);
      assert.equal(filter.user, OWNER_ID);
    }
  } finally {
    Rule.create = originalsForService.create;
    Rule.find = originalsForService.find;
    Rule.findOne = originalsForService.findOne;
    Rule.findOneAndDelete = originalsForService.findOneAndDelete;
    Object.assign(ruleService, activeServiceMocks);
  }
});
