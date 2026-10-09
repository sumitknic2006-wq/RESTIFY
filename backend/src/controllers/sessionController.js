const sessionService = require('../services/sessionService');
const { sendSuccess } = require('../utils/response');

async function startSession(req, res, next) {
  try {
    const session = await sessionService.startSession(req.user.id, req.body);
    return sendSuccess(res, 201, 'Session started successfully.', { session });
  } catch (error) {
    return next(error);
  }
}

async function pauseSession(req, res, next) {
  try {
    const session = await sessionService.pauseSession(req.user.id, req.params.id, req.body);
    return sendSuccess(res, 200, 'Session paused successfully.', { session });
  } catch (error) {
    return next(error);
  }
}

async function resumeSession(req, res, next) {
  try {
    const session = await sessionService.resumeSession(req.user.id, req.params.id);
    return sendSuccess(res, 200, 'Session resumed successfully.', { session });
  } catch (error) {
    return next(error);
  }
}

async function endSession(req, res, next) {
  try {
    const session = await sessionService.endSession(req.user.id, req.params.id);
    return sendSuccess(res, 200, 'Session completed successfully.', { session });
  } catch (error) {
    return next(error);
  }
}

async function getSessions(req, res, next) {
  try {
    const sessions = await sessionService.getSessions(req.user.id);
    return sendSuccess(res, 200, 'Sessions retrieved successfully.', { sessions });
  } catch (error) {
    return next(error);
  }
}

async function getActiveSession(req, res, next) {
  try {
    const session = await sessionService.getActiveSession(req.user.id);
    return sendSuccess(res, 200, 'Active session retrieved successfully.', { session });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  endSession,
  getActiveSession,
  getSessions,
  pauseSession,
  resumeSession,
  startSession,
};
