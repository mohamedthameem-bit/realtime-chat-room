/**
 * authController.js — Sign up, sign in, sign out, and "who am I?" endpoints.
 *
 * Auth strategy: JWT stored in an HttpOnly cookie.
 * - HttpOnly: JavaScript cannot read it → immune to XSS token theft.
 * - Automatically sent with every request by the browser.
 * - Secure flag is set in production so it only travels over HTTPS.
 */

const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const User    = require('../models/User');
const env     = require('../config/env');
const { validateAuthUsername, validatePassword } = require('../middleware/validate');

// ── Cookie helpers ────────────────────────────────────────────────────────────

const COOKIE_NAME = 'token';

/**
 * Build the options object for res.cookie().
 * @returns {object}
 */
function cookieOptions() {
  return {
    httpOnly: true,                            // Not accessible via JS
    secure:   env.NODE_ENV === 'production',   // HTTPS only in prod
    sameSite: 'lax',                           // CSRF mitigation
    maxAge:   7 * 24 * 60 * 60 * 1000,        // 7 days in ms
  };
}

/**
 * Issue a JWT and set it as an HttpOnly cookie on the response.
 * @param {object} res - Express response
 * @param {object} user - Mongoose User document
 */
function issueToken(res, user) {
  const token = jwt.sign(
    { userId: user._id.toString() },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
  res.cookie(COOKIE_NAME, token, cookieOptions());
}

// ── Controllers ───────────────────────────────────────────────────────────────

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * POST /api/auth/signup
 * Body: { username, password }
 */
async function signup(req, res, next) {
  try {
    const { username, password } = req.body;

    // Server-side validation
    const uCheck = validateAuthUsername(username);
    if (!uCheck.valid) {
      return res.status(400).json({ success: false, message: uCheck.error });
    }

    const pCheck = validatePassword(password);
    if (!pCheck.valid) {
      return res.status(400).json({ success: false, message: pCheck.error });
    }

    // Check uniqueness (case-insensitive)
    const existing = await User.findOne({ username: { $regex: new RegExp(`^${escapeRegExp(username.trim())}$`, 'i') } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'That username is already taken. Please choose another.' });
    }

    // Hash the password (cost factor 12 — good balance of security and speed)
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      username: username.trim(),
      passwordHash,
    });

    issueToken(res, user);

    return res.status(201).json({ success: true, user: user.toPublic() });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/signin
 * Body: { username, password }
 * Rate-limited by express-rate-limit in the route file.
 */
async function signin(req, res, next) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    // Find user (case-insensitive match)
    const user = await User.findOne({ username: { $regex: new RegExp(`^${escapeRegExp(username.trim())}$`, 'i') } });

    // Generic error — don't reveal whether the username exists
    const INVALID_MSG = 'Invalid username or password.';

    if (!user) {
      return res.status(401).json({ success: false, message: INVALID_MSG });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: INVALID_MSG });
    }

    issueToken(res, user);

    return res.json({ success: true, user: user.toPublic() });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/signout
 * Clears the JWT cookie.
 */
function signout(req, res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure:   env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
  return res.json({ success: true, message: 'Signed out successfully.' });
}

/**
 * GET /api/auth/me
 * Returns the currently authenticated user's public profile.
 * Used on every page load to check if the user is logged in.
 * Protected by requireAuth middleware.
 */
function me(req, res) {
  // req.user is set by requireAuth middleware
  return res.json({ success: true, user: req.user });
}

module.exports = { signup, signin, signout, me };
