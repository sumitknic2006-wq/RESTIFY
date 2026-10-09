const createAppError = require('../utils/appError');

function validateRequest(validator) {
  return (req, _res, next) => {
    const errors = validator(req.body);

    if (errors.length > 0) {
      return next(
        createAppError(400, 'Please correct the highlighted fields.', 'VALIDATION_ERROR', errors)
      );
    }

    return next();
  };
}

module.exports = validateRequest;
