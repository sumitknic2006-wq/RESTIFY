const createAppError = require('../utils/appError');

const THEME_OPTIONS = new Set(['system', 'light', 'dark']);
const NOTIFICATION_OPTIONS = new Set(['achievements', 'challenges', 'goals']);

function validatePreferences(input) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return [{ field: 'body', message: 'Request body must be an object.' }];
  }

  for (const key of Object.keys(input)) {
    if (!['theme', 'notifications'].includes(key)) {
      errors.push({ field: key, message: 'This setting cannot be changed.' });
    }
  }
  if (Object.hasOwn(input, 'theme') && !THEME_OPTIONS.has(input.theme)) {
    errors.push({ field: 'theme', message: 'Choose system, light, or dark theme.' });
  }
  if (Object.hasOwn(input, 'notifications')) {
    const notifications = input.notifications;
    if (!notifications || typeof notifications !== 'object' || Array.isArray(notifications)) {
      errors.push({ field: 'notifications', message: 'Notification preferences must be an object.' });
    } else {
      for (const [key, value] of Object.entries(notifications)) {
        if (!NOTIFICATION_OPTIONS.has(key)) {
          errors.push({ field: `notifications.${key}`, message: 'This notification preference cannot be changed.' });
        } else if (typeof value !== 'boolean') {
          errors.push({ field: `notifications.${key}`, message: 'Notification preferences must be true or false.' });
        }
      }
      if (Object.keys(notifications).length === 0) {
        errors.push({ field: 'notifications', message: 'Provide at least one notification preference.' });
      }
    }
  }
  if (Object.keys(input).length === 0) {
    errors.push({ field: 'body', message: 'Provide at least one preference to update.' });
  }
  return errors;
}

function assertValidPreferences(input) {
  const errors = validatePreferences(input);
  if (errors.length) {
    throw createAppError(400, 'Please provide valid preferences.', 'VALIDATION_ERROR', errors);
  }
}

module.exports = { assertValidPreferences, validatePreferences };
