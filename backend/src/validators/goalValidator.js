const mongoose = require('mongoose');
const createAppError = require('../utils/appError');

const ALLOWED_CREATE_FIELDS = new Set(['period', 'targetMinutes']);
const ALLOWED_UPDATE_FIELDS = new Set(['period', 'targetMinutes', 'isActive']);

function validateFields(input, allowedFields, { partial = false } = {}) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return [{ field: 'body', message: 'Request body must be an object.' }];
  }
  for (const field of Object.keys(input)) {
    if (!allowedFields.has(field)) errors.push({ field, message: 'This field cannot be changed.' });
  }
  if (partial && Object.keys(input).length === 0) {
    errors.push({ field: 'body', message: 'Provide at least one field to update.' });
  }
  if (!partial && !Object.hasOwn(input, 'period')) {
    errors.push({ field: 'period', message: 'Choose a daily or weekly goal.' });
  }
  if (Object.hasOwn(input, 'period') && !['daily', 'weekly'].includes(input.period)) {
    errors.push({ field: 'period', message: 'Period must be daily or weekly.' });
  }
  if (!partial && !Object.hasOwn(input, 'targetMinutes')) {
    errors.push({ field: 'targetMinutes', message: 'Target duration is required in minutes.' });
  }
  if (Object.hasOwn(input, 'targetMinutes')) {
    const max = input.period === 'daily' ? 1440 : 10080;
    if (
      !Number.isInteger(input.targetMinutes) ||
      input.targetMinutes < 1 ||
      input.targetMinutes > max
    ) {
      errors.push({
        field: 'targetMinutes',
        message: `Target duration must be a whole number between 1 and ${max} minutes.`,
      });
    }
  }
  if (Object.hasOwn(input, 'isActive') && typeof input.isActive !== 'boolean') {
    errors.push({ field: 'isActive', message: 'isActive must be true or false.' });
  }
  return errors;
}

function validateGoalCreate(input) {
  return validateFields(input, ALLOWED_CREATE_FIELDS);
}

function validateGoalUpdate(input) {
  return validateFields(input, ALLOWED_UPDATE_FIELDS, { partial: true });
}

function validateGoalId(req, _res, next, id) {
  if (!mongoose.isObjectIdOrHexString(id)) {
    return next(createAppError(400, 'Goal ID is invalid.', 'INVALID_GOAL_ID'));
  }
  return next();
}

module.exports = { validateGoalCreate, validateGoalId, validateGoalUpdate };
