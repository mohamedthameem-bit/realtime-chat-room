/**
 * errorHandler.js — Global Express error-handling middleware.
 * Must be mounted LAST (after all routes) in server.js.
 */

const env = require('../config/env');

/**
 * Centralized error handler. Sends a clean JSON response without leaking
 * stack traces in production.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || err.status || 500;

  // In development, include the stack trace so debugging is easier
  const response = {
    success: false,
    message: err.message || 'Internal Server Error',
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  };

  console.error(`[ERROR] ${req.method} ${req.path} — ${statusCode}: ${err.message}`);

  res.status(statusCode).json(response);
}

module.exports = errorHandler;
