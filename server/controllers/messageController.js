/**
 * messageController.js — REST API handlers for message-related endpoints.
 */

const Message = require('../models/Message');
const mongoose = require('mongoose');

/**
 * GET /api/health
 * Returns server and database status. Safe to expose publicly.
 */
async function healthCheck(req, res, next) {
  try {
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    const dbState = mongoose.connection.readyState;
    const dbStatus = ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState] || 'unknown';

    res.json({
      success: true,
      server: 'ok',
      database: dbStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/messages/:room
 * Returns the last 50 messages for a given room, oldest to newest.
 * Used as a REST fallback alongside the socket-based initial load.
 */
async function getRecentMessages(req, res, next) {
  try {
    const room = req.params.room.trim().toLowerCase();

    if (!room) {
      const err = new Error('Room name is required.');
      err.statusCode = 400;
      return next(err);
    }

    // Fetch the 50 most recent messages, then reverse for chronological order
    const messages = await Message.find({ room })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(); // .lean() returns plain JS objects — faster, no Mongoose overhead

    res.json({
      success: true,
      room,
      messages: messages.reverse(), // oldest → newest
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { healthCheck, getRecentMessages };
