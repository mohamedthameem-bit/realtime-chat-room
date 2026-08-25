/**
 * auth.js — JWT authentication middleware.
 *
 * requireAuth: Express middleware — verifies the JWT cookie and attaches req.user.
 * socketAuth: Socket.IO middleware — same but for socket connections.
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const env  = require('../config/env');

/**
 * Parse the JWT token from the request's cookies.
 * Returns null if missing or malformed.
 * @param {object} req
 * @returns {string|null}
 */
function extractToken(req) {
  return (req.cookies && req.cookies.token) || null;
}

/**
 * Express middleware — protects routes that require a logged-in user.
 * Attaches the full User document to req.user on success.
 */
async function requireAuth(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required. Please sign in.' });
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);

    // Attach the lean user object — we re-fetch from DB to get latest data
    const user = await User.findById(payload.userId).lean();
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found. Please sign in again.' });
    }

    req.user = user; // { _id, username, name, bio, profilePic, createdAt }
    next();
  } catch (err) {
    // jwt.verify throws if the token is expired or tampered
    return res.status(401).json({ success: false, message: 'Session expired. Please sign in again.' });
  }
}

/**
 * Socket.IO middleware — called once per new socket connection.
 * Reads the JWT from the handshake cookie, verifies it, attaches socket.user.
 * Rejects the connection if auth fails.
 */
async function socketAuth(socket, next) {
  try {
    // Socket.IO passes the raw cookie header in socket.handshake.headers.cookie
    const cookieHeader = socket.handshake.headers.cookie || '';

    // Parse the token manually from the cookie string
    const tokenMatch = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
    const token = tokenMatch ? tokenMatch[1] : null;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    const payload = jwt.verify(token, env.JWT_SECRET);
    const user = await User.findById(payload.userId).lean();

    if (!user) {
      return next(new Error('User not found'));
    }

    socket.user = user; // Attach user to socket for use in handlers
    next();
  } catch (err) {
    next(new Error('Invalid or expired token'));
  }
}

module.exports = { requireAuth, socketAuth };
