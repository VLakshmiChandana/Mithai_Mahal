/**
 * Centralized Application Error Classes and Handler Middleware.
 * Guarantees consistent error response formatting and prevents leakage of
 * stack traces, database credentials, secrets, and raw queries.
 */

const config = require('../config/env');

class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required.') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden. Insufficient permissions or tenant boundary violation.') {
    super(message, 403, 'FORBIDDEN');
  }
}

class ValidationError extends AppError {
  constructor(message = 'Invalid request parameters.', details = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Requested resource not found.') {
    super(message, 404, 'NOT_FOUND');
  }
}

/**
 * Express error handling middleware.
 */
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const isProduction = config.nodeEnv === 'production';

  const response = {
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: isProduction && statusCode === 500 ? 'An unexpected internal error occurred.' : err.message
    }
  };

  if (err.details && Array.isArray(err.details) && err.details.length > 0) {
    response.error.details = err.details;
  }

  // Include stack trace only in local development when not a 4xx client error
  if (!isProduction && statusCode === 500 && err.stack) {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

module.exports = {
  AppError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  NotFoundError,
  errorHandler
};
