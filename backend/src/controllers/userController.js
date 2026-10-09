const { sendSuccess } = require('../utils/response');
const userService = require('../services/userService');

function getCurrentUser(req, res) {
  return sendSuccess(res, 200, 'Current user retrieved successfully.', { user: req.user });
}

async function updatePreferences(req, res, next) {
  try {
    const preferences = await userService.updatePreferences(req.user.id, req.body);
    return sendSuccess(res, 200, 'Preferences updated successfully.', { preferences });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getCurrentUser,
  updatePreferences,
};
