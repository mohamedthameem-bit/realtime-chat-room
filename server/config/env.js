/**
 * env.js — Loads and validates environment variables.
 * Throws a descriptive error on startup if a critical variable is missing.
 */

require('dotenv').config();

const required = ['MONGODB_URI', 'JWT_SECRET'];

required.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}\nCheck your .env file (see .env.example).`);
  }
});

module.exports = {
  MONGODB_URI:    process.env.MONGODB_URI,
  PORT:           parseInt(process.env.PORT, 10) || 3000,
  CORS_ORIGIN:    process.env.CORS_ORIGIN || 'http://localhost:3000',
  NODE_ENV:       process.env.NODE_ENV || 'development',
  JWT_SECRET:     process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
};
