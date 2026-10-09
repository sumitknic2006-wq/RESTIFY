const challengeService = require('../services/challengeService');
const { sendSuccess } = require('../utils/response');

async function getTodayChallenge(req, res, next) {
  try {
    const challenge = await challengeService.getTodayChallenge(req.user.id);
    return sendSuccess(res, 200, 'Daily challenge retrieved successfully.', { challenge });
  } catch (error) {
    return next(error);
  }
}

async function completeTodayChallenge(req, res, next) {
  try {
    const challenge = await challengeService.completeTodayChallenge(req.user.id);
    return sendSuccess(res, 200, 'Daily challenge completed successfully.', { challenge });
  } catch (error) {
    return next(error);
  }
}

module.exports = { completeTodayChallenge, getTodayChallenge };
