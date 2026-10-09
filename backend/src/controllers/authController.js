const authService = require('../services/authService');
const { sendSuccess } = require('../utils/response');

async function register(req, res, next) {
  try {
    const result = await authService.register(req.body);
    return sendSuccess(res, 201, 'Registration successful.', result);
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const result = await authService.login(req.body);
    return sendSuccess(res, 200, 'Login successful.', result);
  } catch (error) {
    return next(error);
  }
}

async function logout(req, res, next) {
  try {
    await authService.revokeUserTokens(req.user.id);
    return sendSuccess(res, 200, 'Logout successful. Active account tokens have been invalidated.');
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  login,
  logout,
  register,
};
