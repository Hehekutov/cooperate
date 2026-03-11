class AppError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

function createError(statusCode, code, message, details) {
  return new AppError(statusCode, code, message, details);
}

function badRequest(message, details) {
  return createError(400, 'BAD_REQUEST', message, details);
}

function unauthorized(message = 'Authentication is required') {
  return createError(401, 'UNAUTHORIZED', message);
}

function forbidden(message = 'You do not have access to this resource') {
  return createError(403, 'FORBIDDEN', message);
}

function notFound(message = 'Resource not found') {
  return createError(404, 'NOT_FOUND', message);
}

function conflict(message, details) {
  return createError(409, 'CONFLICT', message, details);
}

module.exports = {
  AppError,
  badRequest,
  conflict,
  forbidden,
  notFound,
  unauthorized
};
