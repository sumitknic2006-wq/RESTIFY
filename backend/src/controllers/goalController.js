const goalService = require('../services/goalService');
const { sendSuccess } = require('../utils/response');

async function createGoal(req, res, next) {
  try {
    const goal = await goalService.createGoal(req.user.id, req.body);
    return sendSuccess(res, 201, 'Goal created successfully.', { goal });
  } catch (error) {
    return next(error);
  }
}

async function getGoals(req, res, next) {
  try {
    const goals = await goalService.getGoals(req.user.id);
    return sendSuccess(res, 200, 'Goals retrieved successfully.', { goals });
  } catch (error) {
    return next(error);
  }
}

async function getGoal(req, res, next) {
  try {
    const goal = await goalService.getGoalById(req.user.id, req.params.id);
    return sendSuccess(res, 200, 'Goal retrieved successfully.', { goal });
  } catch (error) {
    return next(error);
  }
}

async function getGoalProgress(req, res, next) {
  try {
    const progress = await goalService.getGoalProgress(req.user.id, req.params.id);
    return sendSuccess(res, 200, 'Goal progress retrieved successfully.', { progress });
  } catch (error) {
    return next(error);
  }
}

async function updateGoal(req, res, next) {
  try {
    const goal = await goalService.updateGoal(req.user.id, req.params.id, req.body);
    return sendSuccess(res, 200, 'Goal updated successfully.', { goal });
  } catch (error) {
    return next(error);
  }
}

async function deleteGoal(req, res, next) {
  try {
    const result = await goalService.deleteGoal(req.user.id, req.params.id);
    return sendSuccess(res, 200, 'Goal deleted successfully.', result);
  } catch (error) {
    return next(error);
  }
}

module.exports = { createGoal, deleteGoal, getGoal, getGoalProgress, getGoals, updateGoal };
