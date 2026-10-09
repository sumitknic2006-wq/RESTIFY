const ruleService = require('../services/ruleService');
const { sendSuccess } = require('../utils/response');

async function createRule(req, res, next) {
  try {
    const rule = await ruleService.createRule(req.user.id, req.body);
    return sendSuccess(res, 201, 'Rule created successfully.', { rule });
  } catch (error) {
    return next(error);
  }
}

async function getUserRules(req, res, next) {
  try {
    const rules = await ruleService.getUserRules(req.user.id);
    return sendSuccess(res, 200, 'Rules retrieved successfully.', { rules });
  } catch (error) {
    return next(error);
  }
}

async function getRuleById(req, res, next) {
  try {
    const rule = await ruleService.getRuleById(req.user.id, req.params.id);
    return sendSuccess(res, 200, 'Rule retrieved successfully.', { rule });
  } catch (error) {
    return next(error);
  }
}

async function updateRule(req, res, next) {
  try {
    const rule = await ruleService.updateRule(req.user.id, req.params.id, req.body);
    return sendSuccess(res, 200, 'Rule updated successfully.', { rule });
  } catch (error) {
    return next(error);
  }
}

async function deleteRule(req, res, next) {
  try {
    const result = await ruleService.deleteRule(req.user.id, req.params.id);
    return sendSuccess(res, 200, 'Rule deleted successfully.', result);
  } catch (error) {
    return next(error);
  }
}

async function toggleRule(req, res, next) {
  try {
    const rule = await ruleService.toggleRule(req.user.id, req.params.id);
    return sendSuccess(res, 200, 'Rule state toggled successfully.', { rule });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createRule,
  deleteRule,
  getRuleById,
  getUserRules,
  toggleRule,
  updateRule,
};
