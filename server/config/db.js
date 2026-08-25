/**
 * db.js — Mongoose connection with error handling and event logging.
 */

const mongoose = require('mongoose');
const env = require('./env');

/**
 * Connect to MongoDB. Resolves when connected, rejects on failure.
 * Mongoose handles automatic reconnection internally after the initial connect.
 */
async function connectDB() {
  try {
    await mongoose.connect(env.MONGODB_URI, {
      // These options are defaults in Mongoose 8, listed here for clarity
      serverSelectionTimeoutMS: 5000, // fail fast if Atlas/local is unreachable
    });
    console.log('[DB] Connected to MongoDB');
  } catch (err) {
    console.error('[DB] Initial connection failed:', err.message);
    throw err; // Let server.js decide whether to exit
  }
}

// Log connection lifecycle events
mongoose.connection.on('error', (err) => {
  console.error('[DB] Connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('[DB] Disconnected from MongoDB');
});

mongoose.connection.on('reconnected', () => {
  console.log('[DB] Reconnected to MongoDB');
});

module.exports = { connectDB };
