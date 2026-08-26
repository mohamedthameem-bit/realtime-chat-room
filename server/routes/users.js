/**
 * users.js — User search routes (Phase 6).
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { searchUsers, getUserProfile } = require('../controllers/userController');

router.use(requireAuth);

router.get('/search', searchUsers);
router.get('/:id', getUserProfile);

module.exports = router;
