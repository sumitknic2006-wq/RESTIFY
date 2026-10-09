const mongoose = require('mongoose');
const createAppError = require('../utils/appError');

const ACTIVITIES = [
  'Instagram',
  'YouTube',
  'Facebook',
  'X',
  'Netflix',
  'Any Website',
  'Custom Website',
];
const ACTIONS = [
  'blur',
  'warning',
  'fullscreen_reminder',
  'countdown',
  'custom_message',
  'restriction',
];
const MAX_DURATION_MINUTES = 1440;
const MAX_MESSAGE_LENGTH = 500;
const DOMAIN_PATTERN =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const ACTIVITY_BY_LOWERCASE = new Map(ACTIVITIES.map((activity) => [activity.toLowerCase(), activity]));
const ACTION_BY_LOWERCASE = new Map(
  ACTIONS.map((action) => [action.toLowerCase(), action])
);
ACTION_BY_LOWERCASE.set('fullscreen reminder', 'fullscreen_reminder');
ACTION_BY_LOWERCASE.set('custom message', 'custom_message');

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeDomain(value) {
  if (typeof value !== 'string') return null;
  const domain = value.trim().toLowerCase();
  return DOMAIN_PATTERN.test(domain) ? domain : null;
}

function normalizeActivity(value, target) {
  if (typeof value !== 'string') return { activity: value, target };

  const trimmedActivity = value.trim();
  const predefined = ACTIVITY_BY_LOWERCASE.get(trimmedActivity.toLowerCase());
  if (predefined) {
    return {
      activity: predefined,
      ...(target === undefined ? {} : { target }),
    };
  }

  const customDomain = normalizeDomain(trimmedActivity);
  if (customDomain) {
    return { activity: 'Custom Website', target: customDomain };
  }

  return { activity: trimmedActivity, ...(target === undefined ? {} : { target }) };
}

function prepareRuleInput(input, { partial = false } = {}) {
  const errors = [];
  if (!isObject(input)) {
    return { value: {}, errors: [{ field: 'body', message: 'Request body must be an object.' }] };
  }

  const allowedFields = new Set([
    'activity',
    'target',
    'timeLimit',
    'action',
    'message',
    'restDuration',
    'enabled',
  ]);

  for (const field of Object.keys(input)) {
    if (!allowedFields.has(field)) {
      errors.push({ field, message: 'This field cannot be changed.' });
    }
  }

  if (partial && Object.keys(input).length === 0) {
    errors.push({ field: 'body', message: 'Provide at least one field to update.' });
  }

  let value = { ...input };
  if (Object.hasOwn(input, 'activity')) {
    const normalized = normalizeActivity(input.activity, input.target);
    value = { ...value, ...normalized };
  } else if (Object.hasOwn(input, 'target') && typeof input.target === 'string') {
    value.target = input.target.trim().toLowerCase();
  }

  if (Object.hasOwn(value, 'activity')) {
    if (typeof value.activity !== 'string' || !ACTIVITIES.includes(value.activity)) {
      errors.push({ field: 'activity', message: 'Choose a supported app or website.' });
    }
    if (value.activity === 'Custom Website') {
      if (value.target === undefined && !partial) {
        errors.push({ field: 'target', message: 'A domain is required for a custom website.' });
      } else if (value.target !== undefined && !normalizeDomain(value.target)) {
        errors.push({ field: 'target', message: 'Enter a valid domain, such as example.com.' });
      } else if (value.target !== undefined) {
        value.target = normalizeDomain(value.target);
      }
    } else if (value.target !== undefined && value.target !== null && value.target !== '') {
      errors.push({
        field: 'target',
        message: 'A custom domain can only be set for Custom Website.',
      });
    } else if (value.target !== undefined) {
      delete value.target;
    }
  } else if (Object.hasOwn(value, 'target')) {
    if (!normalizeDomain(value.target)) {
      errors.push({ field: 'target', message: 'Enter a valid domain, such as example.com.' });
    } else {
      value.target = normalizeDomain(value.target);
    }
  }

  for (const [field, required] of [
    ['timeLimit', !partial],
    ['restDuration', !partial],
  ]) {
    if (!Object.hasOwn(value, field)) {
      if (required) errors.push({ field, message: `${field} is required in minutes.` });
      continue;
    }
    const duration = value[field];
    if (
      typeof duration !== 'number' ||
      !Number.isInteger(duration) ||
      duration < 1 ||
      duration > MAX_DURATION_MINUTES
    ) {
      errors.push({
        field,
        message: `${field} must be a whole number between 1 and ${MAX_DURATION_MINUTES} minutes.`,
      });
    }
  }

  if (!Object.hasOwn(value, 'activity') && !partial) {
    errors.push({ field: 'activity', message: 'Activity is required.' });
  }
  if (!Object.hasOwn(value, 'action') && !partial) {
    errors.push({ field: 'action', message: 'Action is required.' });
  } else if (
    Object.hasOwn(value, 'action') &&
    (typeof value.action !== 'string' ||
      !ACTION_BY_LOWERCASE.has(value.action.trim().toLowerCase()))
  ) {
    errors.push({ field: 'action', message: 'Choose a supported intervention action.' });
  } else if (Object.hasOwn(value, 'action')) {
    value.action = ACTION_BY_LOWERCASE.get(value.action.trim().toLowerCase());
  }

  if (!Object.hasOwn(value, 'message') && !partial) {
    errors.push({ field: 'message', message: 'Message is required.' });
  } else if (Object.hasOwn(value, 'message')) {
    if (
      typeof value.message !== 'string' ||
      value.message.trim().length < 1 ||
      value.message.trim().length > MAX_MESSAGE_LENGTH
    ) {
      errors.push({
        field: 'message',
        message: `Message must be between 1 and ${MAX_MESSAGE_LENGTH} characters.`,
      });
    } else {
      value.message = value.message.trim();
    }
  }

  if (Object.hasOwn(value, 'enabled') && typeof value.enabled !== 'boolean') {
    errors.push({ field: 'enabled', message: 'Enabled must be true or false.' });
  }

  return { value, errors };
}

function validateRuleCreate(input) {
  return prepareRuleInput(input).errors;
}

function validateRuleUpdate(input) {
  return prepareRuleInput(input, { partial: true }).errors;
}

function validateRuleId(req, _res, next) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return next(createAppError(400, 'Rule ID is invalid.', 'INVALID_RULE_ID'));
  }
  return next();
}

module.exports = {
  ACTIONS,
  ACTIVITIES,
  MAX_DURATION_MINUTES,
  normalizeDomain,
  prepareRuleInput,
  validateRuleCreate,
  validateRuleId,
  validateRuleUpdate,
};
