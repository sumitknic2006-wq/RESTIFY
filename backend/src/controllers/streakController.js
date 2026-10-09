const streakService = require('../services/streakService');
const { sendSuccess } = require('../utils/response');

async function getStreak(req, res, next) {
  try {
    const streak = await streakService.getStreak(req.user.id);
    return sendSuccess(res, 200, 'Streak retrieved successfully.', { streak });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getStreak };
