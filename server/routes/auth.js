/**
 * auth.js — Authentication routes.
 * Rate-limits the sign-in endpoint to prevent brute-force attacks.
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const { signup, signin, signout, me } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

// Rate limiter for sign-in: max 5 attempts per IP per 60 seconds
const signinLimiter = rateLimit({
  windowMs:  60 * 1000,  // 1 minute
  max:       5,
  // After 5 failures, the user sees this message for 60 seconds
  message:   { success: false, message: 'Too many sign-in attempts. Please wait 60 seconds and try again.' },
  standardHeaders: true,
  legacyHeaders:   false,
  // Only count failed responses (status >= 400) against the limit
  skipSuccessfulRequests: true,
});

// POST /api/auth/signup
router.post('/signup', signup);

// POST /api/auth/signin  (rate-limited)
router.post('/signin', signinLimiter, signin);

// POST /api/auth/signout  (clears JWT cookie)
router.post('/signout', signout);

// GET /api/auth/me  (returns current user — used by every page on load)
router.get('/me', requireAuth, me);

module.exports = router;
