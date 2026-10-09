const { verifyToken } = require('../utils/jwt');
const createAppError = require('../utils/appError');
const authService = require('../services/authService');

async function requireAuth(req, _res, next) {
  const authorization = req.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);

  if (!match) {
    return next(createAppError(401, 'Authentication required.', 'UNAUTHORIZED'));
  }

  let payload;
  try {
    payload = verifyToken(match[1]);
  } catch (error) {
    if (
      error.name === 'TokenExpiredError' ||
      error.name === 'JsonWebTokenError' ||
      error.name === 'NotBeforeError'
    ) {
      return next(createAppError(401, 'Authentication required.', 'UNAUTHORIZED'));
    }

    return next(error);
  }

  if (typeof payload.sub !== 'string' || !payload.sub) {
    return next(createAppError(401, 'Authentication required.', 'UNAUTHORIZED'));
  }

  try {
    req.user = await authService.getCurrentUser(payload.sub, payload.ver ?? 0);
    req.authToken = payload;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = requireAuth;
