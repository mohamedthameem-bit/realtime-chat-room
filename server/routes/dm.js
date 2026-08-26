/**
 * dm.js — Direct Messaging routes (Phase 6).
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const {
  getConversations,
  startConversation,
  getConversationMessages,
} = require('../controllers/dmController');

router.use(requireAuth);

router.get('/conversations', getConversations);
router.post('/conversations', startConversation);
router.get('/conversations/:id/messages', getConversationMessages);

module.exports = router;
