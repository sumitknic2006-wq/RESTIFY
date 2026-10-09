function createAppError(statusCode, message, code, details) {
  const error = new Error(message);
  error.name = 'AppError';
  error.statusCode = statusCode;
  error.code = code;

  if (details) {
    error.details = details;
  }

  return error;
}

module.exports = createAppError;
