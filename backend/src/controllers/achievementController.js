const achievementService = require('../services/achievementService');
const { sendSuccess } = require('../utils/response');

async function getAchievements(req, res, next) {
  try {
    const achievements = await achievementService.getAchievements(req.user.id);
    return sendSuccess(res, 200, 'Achievements retrieved successfully.', { achievements });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getAchievements };
