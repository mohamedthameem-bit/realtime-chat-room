/**
 * api.js — REST API routes (Phase 1 + Phase 2 + Phase 5).
 */

const express = require('express');
const router  = express.Router();

const { healthCheck, getRecentMessages } = require('../controllers/messageController');
const { requireAuth } = require('../middleware/auth');

// Mount Phase 2 route groups
router.use('/auth',     require('./auth'));
router.use('/rooms',    require('./rooms'));
router.use('/profile',  require('./profile'));

// Mount Phase 5 message actions
router.use('/messages', require('./messages'));

// GET /api/health — public, no auth required
router.get('/health', healthCheck);

// GET /api/messages/:room — protected: only authenticated users can read history
router.get('/messages/:room', requireAuth, getRecentMessages);

module.exports = router;

