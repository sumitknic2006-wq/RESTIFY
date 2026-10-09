const analyticsService = require('../services/analyticsService');
const { sendSuccess } = require('../utils/response');

function createHandler(method, message, dataKey) {
  return async (req, res, next) => {
    try {
      const data = await analyticsService[method](req.user.id);
      return sendSuccess(res, 200, message, { [dataKey]: data });
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = {
  getActivityRanking: createHandler(
    'getActivityRanking',
    'Activity ranking retrieved successfully.',
    'ranking'
  ),
  getHeatmap: createHandler('getHeatmap', 'Screen-time heatmap retrieved successfully.', 'heatmap'),
  getMonthlyAnalytics: createHandler(
    'getMonthlyAnalytics',
    'Monthly analytics retrieved successfully.',
    'analytics'
  ),
  getTodayAnalytics: createHandler(
    'getTodayAnalytics',
    "Today's analytics retrieved successfully.",
    'analytics'
  ),
  getWeeklyAnalytics: createHandler(
    'getWeeklyAnalytics',
    'Weekly analytics retrieved successfully.',
    'analytics'
  ),
};
