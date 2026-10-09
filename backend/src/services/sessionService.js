const mongoose = require('mongoose');
const Rule = require('../models/Rule');
const Session = require('../models/Session');
const createAppError = require('../utils/appError');
const { validateStartSession } = require('../validators/sessionValidator');

function assertValidSessionId(sessionId) {
  if (!mongoose.isObjectIdOrHexString(sessionId)) {
    throw createAppError(400, 'Session ID is invalid.', 'INVALID_SESSION_ID');
  }
}

function serializeSession(session, now = new Date()) {
  let durationSeconds = session.durationSeconds;
  if (session.status === 'active' && session.lastResumedAt) {
    durationSeconds += Math.max(
      0,
      Math.floor((now.getTime() - session.lastResumedAt.getTime()) / 1000)
    );
  }

  return {
    id: session._id.toString(),
    ruleId: session.ruleId ? session.ruleId.toString() : null,
    ruleSnapshot: session.ruleSnapshot || null,
    startTime: session.startTime,
    endTime: session.endTime,
    status: session.status,
    pauseHistory: session.pauseHistory.map((pause) => ({
      startTime: pause.startTime,
      endTime: pause.endTime,
      durationSeconds: pause.durationSeconds,
    })),
    durationSeconds,
    restStartedAt: session.restStartedAt,
    restEndsAt: session.restEndsAt,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

async function findOwnedSession(userId, sessionId) {
  assertValidSessionId(sessionId);
  const session = await Session.findOne({ _id: sessionId, user: userId });
  if (!session) {
    throw createAppError(404, 'Session not found.', 'SESSION_NOT_FOUND');
  }
  return session;
}

function assertStatus(session, expectedStatus, operation) {
  if (session.status !== expectedStatus) {
    throw createAppError(
      409,
      `Cannot ${operation} a session in the ${session.status} state.`,
      'INVALID_SESSION_STATE'
    );
  }
}

async function saveSession(session) {
  try {
    await session.save();
  } catch (error) {
    if (error.name === 'VersionError') {
      throw createAppError(
        409,
        'The session changed during this request. Reload it and try again.',
        'SESSION_STATE_CONFLICT'
      );
    }
    throw error;
  }
}

async function startSession(userId, input = {}) {
  const errors = validateStartSession(input);
  if (errors.length) {
    throw createAppError(400, 'Please provide valid session information.', 'VALIDATION_ERROR', errors);
  }

  let rule;
  if (input.ruleId) {
    rule = await Rule.findOne({ _id: input.ruleId, user: userId, enabled: true });
    if (!rule) {
      throw createAppError(409, 'Choose an enabled rule before starting a timer.', 'RULE_UNAVAILABLE');
    }
  }

  const existing = await Session.findOne({ user: userId, status: { $in: ['active', 'paused'] } })
    .select('_id');
  if (existing) {
    throw createAppError(409, 'End the current session before starting another.', 'SESSION_ALREADY_ACTIVE');
  }

  const startTime = new Date();
  try {
    const session = await Session.create({
      user: userId,
      ...(rule
        ? {
            ruleId: rule._id,
            ruleSnapshot: {
              activity: rule.activity,
              target: rule.target || null,
              timeLimit: rule.timeLimit,
              action: rule.action,
              message: rule.message,
              restDuration: rule.restDuration,
            },
          }
        : {}),
      activeOwner: userId,
      startTime,
      lastResumedAt: startTime,
      status: 'active',
      durationSeconds: 0,
    });
    return serializeSession(session, startTime);
  } catch (error) {
    if (error.code === 11000) {
      throw createAppError(409, 'End the current session before starting another.', 'SESSION_ALREADY_ACTIVE');
    }
    throw error;
  }
}

async function pauseSession(userId, sessionId, { rest = false } = {}) {
  const session = await findOwnedSession(userId, sessionId);
  assertStatus(session, 'active', 'pause');
  if (!session.lastResumedAt) {
    throw createAppError(409, 'Session timing data is invalid.', 'INVALID_SESSION_STATE');
  }
  const pausedAt = new Date();
  const activeSeconds = Math.max(
    0,
    Math.floor((pausedAt.getTime() - session.lastResumedAt.getTime()) / 1000)
  );
  const totalDurationSeconds = session.durationSeconds + activeSeconds;
  if (rest) {
    if (!session.ruleSnapshot || !session.ruleId) {
      throw createAppError(409, 'This session has no configured rest period.', 'REST_NOT_CONFIGURED');
    }
    const rule = await Rule.findOne({
      _id: session.ruleId,
      user: userId,
      enabled: true,
    }).select('_id');
    if (!rule) {
      throw createAppError(409, 'The associated rule is no longer enabled.', 'RULE_UNAVAILABLE');
    }
    if (totalDurationSeconds < session.ruleSnapshot.timeLimit * 60) {
      throw createAppError(409, 'The configured time limit has not been reached.', 'TIME_LIMIT_NOT_REACHED');
    }
  }

  session.durationSeconds = totalDurationSeconds;
  session.pauseHistory.push({
    startTime: pausedAt,
    endTime: null,
    durationSeconds: 0,
  });
  session.lastResumedAt = null;
  session.status = 'paused';
  if (rest) {
    session.restStartedAt = pausedAt;
    session.restEndsAt = new Date(
      pausedAt.getTime() + session.ruleSnapshot.restDuration * 60 * 1000
    );
  } else {
    session.restStartedAt = null;
    session.restEndsAt = null;
  }
  await saveSession(session);
  return serializeSession(session, pausedAt);
}

async function resumeSession(userId, sessionId) {
  const session = await findOwnedSession(userId, sessionId);
  assertStatus(session, 'paused', 'resume');
  const resumedAt = new Date();
  if (session.restEndsAt && resumedAt < session.restEndsAt) {
    throw createAppError(409, 'The configured rest period is still in progress.', 'REST_PERIOD_ACTIVE');
  }
  const currentPause = session.pauseHistory[session.pauseHistory.length - 1];
  if (!currentPause || currentPause.endTime) {
    throw createAppError(409, 'Session pause data is invalid.', 'INVALID_SESSION_STATE');
  }

  currentPause.endTime = resumedAt;
  currentPause.durationSeconds = Math.max(
    0,
    Math.floor((resumedAt.getTime() - currentPause.startTime.getTime()) / 1000)
  );
  session.lastResumedAt = resumedAt;
  session.status = 'active';
  session.restStartedAt = null;
  session.restEndsAt = null;
  await saveSession(session);
  return serializeSession(session, resumedAt);
}

async function endSession(userId, sessionId) {
  const session = await findOwnedSession(userId, sessionId);
  if (session.status !== 'active' && session.status !== 'paused') {
    throw createAppError(
      409,
      `Cannot end a session in the ${session.status} state.`,
      'INVALID_SESSION_STATE'
    );
  }

  const endTime = new Date();
  if (session.status === 'active') {
    session.durationSeconds += Math.max(
      0,
      Math.floor((endTime.getTime() - session.lastResumedAt.getTime()) / 1000)
    );
    session.lastResumedAt = null;
  } else {
    const currentPause = session.pauseHistory[session.pauseHistory.length - 1];
    if (!currentPause || currentPause.endTime) {
      throw createAppError(409, 'Session pause data is invalid.', 'INVALID_SESSION_STATE');
    }
    currentPause.endTime = endTime;
    currentPause.durationSeconds = Math.max(
      0,
      Math.floor((endTime.getTime() - currentPause.startTime.getTime()) / 1000)
    );
  }

  session.endTime = endTime;
  session.status = 'completed';
  session.restStartedAt = null;
  session.restEndsAt = null;
  session.activeOwner = undefined;
  await saveSession(session);
  return serializeSession(session, endTime);
}

async function getActiveSession(userId) {
  const session = await Session.findOne({
    user: userId,
    status: { $in: ['active', 'paused'] },
  }).sort({ startTime: -1 });
  return session ? serializeSession(session) : null;
}

async function getSessions(userId) {
  const sessions = await Session.find({ user: userId }).sort({ startTime: -1 });
  return sessions.map((session) => serializeSession(session));
}

module.exports = {
  endSession,
  getActiveSession,
  getSessions,
  pauseSession,
  resumeSession,
  startSession,
};
