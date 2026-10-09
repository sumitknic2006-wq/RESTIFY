const mongoose = require('mongoose');

const INVALID_BODY = [{ field: 'body', message: 'Request body must be an object.' }];

function validateActivityStart(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return INVALID_BODY;
  }

  const errors = [];
  const allowed = new Set(['activity', 'target']);
  for (const field of Object.keys(body)) {
    if (!allowed.has(field)) {
      errors.push({ field, message: 'This field is not accepted.' });
    }
  }

  if (typeof body.activity !== 'string' || !body.activity.trim()) {
    errors.push({ field: 'activity', message: 'Activity is required.' });
  } else if (
    body.activity.trim().length > 100 ||
    /[\u0000-\u001f\u007f]/.test(body.activity)
  ) {
    errors.push({ field: 'activity', message: 'Activity must be 100 characters or fewer.' });
  }

  if (body.target !== undefined) {
    if (
      typeof body.target !== 'string' ||
      !body.target.trim() ||
      body.target.trim().length > 253 ||
      /[\u0000-\u0020\u007f]/.test(body.target)
    ) {
      errors.push({ field: 'target', message: 'Target must be a valid non-empty value.' });
    }
  }

  return errors;
}

function validateActivityId(req, _res, next) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    const error = new Error('Activity ID is invalid.');
    error.name = 'AppError';
    error.statusCode = 400;
    error.code = 'INVALID_ACTIVITY_ID';
    return next(error);
  }
  return next();
}

module.exports = {
  validateActivityId,
  validateActivityStart,
};
