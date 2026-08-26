/**
 * friends.js — Friend routes (Phase 6).
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const {
  sendRequest,
  acceptRequest,
  declineRequest,
  removeFriend,
  getFriends,
  getRequests,
} = require('../controllers/friendController');

router.use(requireAuth);

router.post('/request', sendRequest);
router.post('/accept', acceptRequest);
router.post('/decline', declineRequest);
router.delete('/:userId', removeFriend);
router.get('/', getFriends);
router.get('/requests', getRequests);

module.exports = router;
