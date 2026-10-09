const createAppError = require('../utils/appError');

function requireAdmin(req, _res, next) {
  if (req.user?.role !== 'admin') {
    return next(createAppError(403, 'Administrator access is required.', 'FORBIDDEN'));
  }
  return next();
}

module.exports = requireAdmin;
