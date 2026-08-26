/**
 * messages.js — Message action routes (Phase 5: edit, delete, react).
 */

const express = require('express');
const router  = express.Router();

const { editMessage, deleteMessage, reactToMessage } = require('../controllers/messageActionsController');
const { requireAuth } = require('../middleware/auth');

// All message-action routes require authentication
router.use(requireAuth);

// PATCH  /api/messages/:id          — edit own message
router.patch('/:id', editMessage);

// DELETE /api/messages/:id          — delete own message (or room creator)
router.delete('/:id', deleteMessage);

// POST   /api/messages/:id/react    — toggle emoji reaction
router.post('/:id/react', reactToMessage);

module.exports = router;
