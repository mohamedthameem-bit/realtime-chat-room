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
  createGroupChat,
  togglePinConversation,
  toggleMuteConversation,
  toggleDisappearingMessages
} = require('../controllers/dmController');

router.use(requireAuth);

router.get('/conversations', getConversations);
router.post('/conversations', startConversation);
router.post('/groups', createGroupChat);
router.get('/conversations/:id/messages', getConversationMessages);
router.put('/conversations/:id/pin', togglePinConversation);
router.put('/conversations/:id/mute', toggleMuteConversation);
router.put('/conversations/:id/disappearing', toggleDisappearingMessages);

module.exports = router;
