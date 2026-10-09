const mongoose = require('mongoose');
const Rule = require('../models/Rule');
const createAppError = require('../utils/appError');
const { prepareRuleInput, validateRuleCreate, validateRuleUpdate } = require('../validators/ruleValidator');

function assertValidRuleId(ruleId) {
  if (!mongoose.isObjectIdOrHexString(ruleId)) {
    throw createAppError(400, 'Rule ID is invalid.', 'INVALID_RULE_ID');
  }
}

function assertValidInput(input, validator) {
  const errors = validator(input);
  if (errors.length) {
    throw createAppError(400, 'Please provide valid rule information.', 'VALIDATION_ERROR', errors);
  }
}

function serializeRule(rule) {
  return {
    id: rule._id.toString(),
    activity: rule.activity,
    target: rule.target || null,
    timeLimit: rule.timeLimit,
    action: rule.action,
    message: rule.message,
    restDuration: rule.restDuration,
    enabled: rule.enabled,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  };
}

function notFound() {
  return createAppError(404, 'Rule not found.', 'RULE_NOT_FOUND');
}

async function createRule(userId, input) {
  assertValidInput(input, validateRuleCreate);
  const { value } = prepareRuleInput(input);
  const rule = await Rule.create({ ...value, user: userId });
  return serializeRule(rule);
}

async function getUserRules(userId) {
  const rules = await Rule.find({ user: userId }).sort({ createdAt: -1 });
  return rules.map(serializeRule);
}

async function getRuleById(userId, ruleId) {
  assertValidRuleId(ruleId);
  const rule = await Rule.findOne({ _id: ruleId, user: userId });
  if (!rule) throw notFound();
  return serializeRule(rule);
}

async function updateRule(userId, ruleId, input) {
  assertValidRuleId(ruleId);
  assertValidInput(input, validateRuleUpdate);
  const rule = await Rule.findOne({ _id: ruleId, user: userId });
  if (!rule) throw notFound();

  const { value: changes } = prepareRuleInput(input, { partial: true });
  const updated = {
    activity: rule.activity,
    target: rule.target,
    timeLimit: rule.timeLimit,
    action: rule.action,
    message: rule.message,
    restDuration: rule.restDuration,
    enabled: rule.enabled,
    ...changes,
  };
  if (
    Object.hasOwn(changes, 'activity') &&
    changes.activity !== 'Custom Website' &&
    !Object.hasOwn(changes, 'target')
  ) {
    updated.target = undefined;
  }

  assertValidInput(updated, validateRuleCreate);

  for (const field of [
    'activity',
    'target',
    'timeLimit',
    'action',
    'message',
    'restDuration',
    'enabled',
  ]) {
    if (Object.hasOwn(changes, field)) rule[field] = changes[field];
  }
  if (
    Object.hasOwn(changes, 'activity') &&
    changes.activity !== 'Custom Website' &&
    !Object.hasOwn(changes, 'target')
  ) {
    rule.target = undefined;
  }

  await rule.save();
  return serializeRule(rule);
}

async function deleteRule(userId, ruleId) {
  assertValidRuleId(ruleId);
  const rule = await Rule.findOneAndDelete({ _id: ruleId, user: userId });
  if (!rule) throw notFound();
  return { id: rule._id.toString() };
}

async function toggleRule(userId, ruleId) {
  assertValidRuleId(ruleId);
  const rule = await Rule.findOne({ _id: ruleId, user: userId });
  if (!rule) throw notFound();
  rule.enabled = !rule.enabled;
  await rule.save();
  return serializeRule(rule);
}

module.exports = {
  createRule,
  deleteRule,
  getRuleById,
  getUserRules,
  toggleRule,
  updateRule,
};
