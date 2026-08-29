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

// Mount Phase 6 & 8 social routes
router.use('/dm', require('./dm'));
router.use('/users', require('./users'));
router.use('/friends', require('./friends'));
router.use('/follow', require('./follow'));
router.use('/notifications', require('./notifications'));
router.use('/posts', require('./posts'));
router.use('/comments', require('./comments'));
router.use('/stories', require('./stories'));
router.use('/highlights', require('./highlights'));
router.use('/notes', require('./notes'));
router.use('/reels', require('./reels'));
router.use('/explore', require('./explore'));

// GET /api/health — public, no auth required
router.get('/health', healthCheck);

// GET /api/messages/:room — protected: only authenticated users can read history
router.get('/messages/:room', requireAuth, getRecentMessages);

module.exports = router;

