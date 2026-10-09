const { rateLimit } = require('express-rate-limit');
const { sendError } = require('../utils/response');

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler(_req, res) {
    return sendError(
      res,
      429,
      'Too many authentication attempts. Please try again later.',
      'RATE_LIMITED'
    );
  },
});

module.exports = authRateLimit;
