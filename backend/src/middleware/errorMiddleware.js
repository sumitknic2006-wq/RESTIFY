const { sendError } = require('../utils/response');

function errorMiddleware(error, _req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  let statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
  let message = statusCode < 500 ? error.message : 'An unexpected error occurred.';
  let code = error.code || (statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR');

  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Please provide valid user information.';
    code = 'VALIDATION_ERROR';
  } else if (error.name === 'CastError') {
    statusCode = 400;
    message = 'The request contains an invalid identifier.';
    code = 'INVALID_IDENTIFIER';
  } else if (error.code === 11000) {
    statusCode = 409;
    message = 'An account with this email already exists.';
    code = 'EMAIL_ALREADY_EXISTS';
  } else if (error.type === 'entity.too.large') {
    statusCode = 413;
    message = 'Request body is too large.';
    code = 'PAYLOAD_TOO_LARGE';
  } else if (error instanceof SyntaxError && error.status === 400) {
    statusCode = 400;
    message = 'Request body must contain valid JSON.';
    code = 'INVALID_JSON';
  }

  if (statusCode >= 500) {
    console.error('Request failed:', error.name || 'InternalError');
  }

  return sendError(res, statusCode, message, code, error.details);
}

module.exports = errorMiddleware;
