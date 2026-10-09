const activityService = require('../services/activityService');
const { sendSuccess } = require('../utils/response');

async function startActivity(req, res, next) {
  try {
    const activity = await activityService.startActivity(req.user.id, req.body);
    return sendSuccess(res, 201, 'Activity started successfully.', { activity });
  } catch (error) {
    return next(error);
  }
}

async function stopActivity(req, res, next) {
  try {
    const activity = await activityService.stopActivity(req.user.id);
    return sendSuccess(res, 200, 'Activity stopped successfully.', { activity });
  } catch (error) {
    return next(error);
  }
}

async function getUserActivities(req, res, next) {
  try {
    const activities = await activityService.getUserActivities(req.user.id);
    return sendSuccess(res, 200, 'Activities retrieved successfully.', { activities });
  } catch (error) {
    return next(error);
  }
}

async function getTodayActivities(req, res, next) {
  try {
    const activities = await activityService.getTodayActivities(req.user.id);
    return sendSuccess(res, 200, "Today's activities retrieved successfully.", { activities });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getTodayActivities,
  getUserActivities,
  startActivity,
  stopActivity,
};
