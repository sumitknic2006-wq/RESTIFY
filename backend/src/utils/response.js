function sendSuccess(res, statusCode, message, data) {
  return res.status(statusCode).json({
    success: true,
    message,
    ...(data === undefined ? {} : { data }),
  });
}

function sendError(res, statusCode, message, code, details) {
  return res.status(statusCode).json({
    success: false,
    message,
    ...(code ? { code } : {}),
    ...(details ? { errors: details } : {}),
  });
}

module.exports = {
  sendError,
  sendSuccess,
};
