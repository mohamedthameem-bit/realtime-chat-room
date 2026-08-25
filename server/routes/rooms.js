/**
 * rooms.js — Room management routes (all protected by requireAuth).
 */

const express = require('express');
const router = express.Router();

const {
  listRooms,
  createRoom,
  joinRoom,
  leaveRoom,
  getRoom,
  deleteRoom,
  updateRoomSettings,
  kickMember,
  banMember,
  unbanMember,
  getBannedUsers,
} = require('../controllers/roomController');
const { requireAuth } = require('../middleware/auth');

// All room routes require a valid session
router.use(requireAuth);

// GET    /api/rooms            — list all rooms
router.get('/',             listRooms);

// POST   /api/rooms            — create a new room
router.post('/',            createRoom);

// GET    /api/rooms/:id        — get single room details
router.get('/:id',          getRoom);

// DELETE /api/rooms/:id        — delete room (creator only)
router.delete('/:id',       deleteRoom);

// PATCH  /api/rooms/:id/settings — update room settings/password (creator only)
router.patch('/:id/settings', updateRoomSettings);

// POST   /api/rooms/:id/join   — join a room (validates capacity + password + restriction)
router.post('/:id/join',    joinRoom);

// POST   /api/rooms/:id/leave  — leave a room
router.post('/:id/leave',   leaveRoom);

// POST   /api/rooms/:id/kick   — kick member from room (creator only)
router.post('/:id/kick',    kickMember);

// POST   /api/rooms/:id/ban    — restrict member from room (creator only)
router.post('/:id/ban',     banMember);

// POST   /api/rooms/:id/unban  — lift restriction for member (creator only)
router.post('/:id/unban',   unbanMember);

// GET    /api/rooms/:id/banned — list restricted members (creator only)
router.get('/:id/banned',   getBannedUsers);

module.exports = router;

