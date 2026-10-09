const assert = require('node:assert/strict');
const { test } = require('node:test');
const mongoose = require('mongoose');
const Rule = require('../src/models/Rule');
const Session = require('../src/models/Session');
const sessionService = require('../src/services/sessionService');
const {
  validatePauseSession,
  validateStartSession,
} = require('../src/validators/sessionValidator');

test('session timer inputs accept an optional owned rule reference and reject client-controlled fields', () => {
  const ruleId = new mongoose.Types.ObjectId().toString();
  assert.deepEqual(validateStartSession(), []);
  assert.deepEqual(validateStartSession({ ruleId }), []);
  assert.ok(validateStartSession({ ruleId: 'invalid' }).some((item) => item.field === 'ruleId'));
  assert.ok(validateStartSession({ userId: 'spoofed' }).some((item) => item.field === 'userId'));
  assert.deepEqual(validatePauseSession(), []);
  assert.deepEqual(validatePauseSession({ rest: true }), []);
  assert.ok(validatePauseSession({ rest: 'yes' }).some((item) => item.field === 'rest'));
  assert.ok(validatePauseSession({ durationSeconds: 500 }).some((item) => item.field === 'durationSeconds'));
});

test('rule-linked sessions snapshot the owned enabled rule and persist a rest period', async () => {
  const originals = {
    ruleFindOne: Rule.findOne,
    sessionFindOne: Session.findOne,
    sessionCreate: Session.create,
  };
  const userId = new mongoose.Types.ObjectId().toString();
  const ruleId = new mongoose.Types.ObjectId();
  const sessionId = new mongoose.Types.ObjectId();
  const rule = {
    _id: ruleId,
    activity: 'Custom Website',
    target: 'example.com',
    timeLimit: 1,
    action: 'custom_message',
    message: 'Take a mindful break.',
    restDuration: 2,
    enabled: true,
  };
  let created;
  const session = {
    _id: sessionId,
    user: userId,
    status: 'active',
    startTime: new Date(),
    lastResumedAt: new Date(),
    durationSeconds: 0,
    pauseHistory: [],
    restStartedAt: null,
    restEndsAt: null,
    save: async () => {},
  };

  Rule.findOne = async (filter) => {
    assert.equal(filter._id, ruleId.toString());
    assert.equal(filter.user, userId);
    assert.equal(filter.enabled, true);
    return rule;
  };
  Session.findOne = (filter) => (
    filter._id
      ? Promise.resolve(session)
      : { select: async () => null }
  );
  Session.create = async (fields) => {
    created = fields;
    Object.assign(session, fields);
    return session;
  };

  try {
    const started = await sessionService.startSession(userId, { ruleId: ruleId.toString() });
    assert.equal(started.ruleId, ruleId.toString());
    assert.deepEqual(started.ruleSnapshot, {
      activity: 'Custom Website',
      target: 'example.com',
      timeLimit: 1,
      action: 'custom_message',
      message: 'Take a mindful break.',
      restDuration: 2,
    });
    assert.equal(created.ruleId, ruleId);

    Rule.findOne = (filter) => {
      assert.equal(filter._id, ruleId);
      assert.equal(filter.user, userId);
      assert.equal(filter.enabled, true);
      return { select: async () => ({ _id: ruleId }) };
    };
    await assert.rejects(
      sessionService.pauseSession(userId, sessionId.toString(), { rest: true }),
      (error) => error.code === 'TIME_LIMIT_NOT_REACHED'
    );
    session.lastResumedAt = new Date(Date.now() - 61000);
    const paused = await sessionService.pauseSession(userId, sessionId.toString(), { rest: true });
    assert.equal(paused.status, 'paused');
    assert.ok(paused.restStartedAt instanceof Date);
    assert.equal(paused.restEndsAt.getTime() - paused.restStartedAt.getTime(), 120000);
    await assert.rejects(
      sessionService.resumeSession(userId, sessionId.toString()),
      (error) => error.code === 'REST_PERIOD_ACTIVE'
    );

    session.restEndsAt = new Date(Date.now() - 1000);
    const resumed = await sessionService.resumeSession(userId, sessionId.toString());
    assert.equal(resumed.status, 'active');
    assert.equal(resumed.restEndsAt, null);
  } finally {
    Rule.findOne = originals.ruleFindOne;
    Session.findOne = originals.sessionFindOne;
    Session.create = originals.sessionCreate;
  }
});

test('starting a timer with a disabled or unowned rule is rejected', async () => {
  const originalRuleFindOne = Rule.findOne;
  const userId = new mongoose.Types.ObjectId().toString();
  const ruleId = new mongoose.Types.ObjectId().toString();
  Rule.findOne = async () => null;
  try {
    await assert.rejects(
      sessionService.startSession(userId, { ruleId }),
      (error) => error.code === 'RULE_UNAVAILABLE'
    );
  } finally {
    Rule.findOne = originalRuleFindOne;
  }
});
