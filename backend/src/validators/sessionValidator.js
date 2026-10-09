const mongoose = require('mongoose');
const createAppError = require('../utils/appError');

function validateStartSession(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return [{ field: 'body', message: 'Request body must be an object.' }];
  }
  const errors = [];
  for (const field of Object.keys(input)) {
    if (field !== 'ruleId') {
      errors.push({ field, message: 'This field cannot be changed.' });
    }
  }
  if (
    Object.hasOwn(input, 'ruleId') &&
    !mongoose.isObjectIdOrHexString(input.ruleId)
  ) {
    errors.push({ field: 'ruleId', message: 'Rule ID is invalid.' });
  }
  return errors;
}

function validatePauseSession(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return [{ field: 'body', message: 'Request body must be an object.' }];
  }
  const errors = [];
  for (const field of Object.keys(input)) {
    if (field !== 'rest') {
      errors.push({ field, message: 'This field cannot be changed.' });
    }
  }
  if (Object.hasOwn(input, 'rest') && typeof input.rest !== 'boolean') {
    errors.push({ field: 'rest', message: 'Rest must be true or false.' });
  }
  return errors;
}

function validateSessionId(req, _res, next) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return next(createAppError(400, 'Session ID is invalid.', 'INVALID_SESSION_ID'));
  }
  return next();
}

module.exports = {
  validatePauseSession,
  validateSessionId,
  validateStartSession,
};
