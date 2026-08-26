/**
 * roomController.js — CRUD and join/leave logic for chat rooms.
 */

const bcrypt       = require('bcryptjs');
const Room         = require('../models/Room');
const UserRoomRead = require('../models/UserRoomRead');
const { validateRoomName, validateRoomPassword } = require('../middleware/validate');

// ── List Rooms ────────────────────────────────────────────────────────────────

/**
 * GET /api/rooms
 * Returns all rooms (public + private) with member count.
 * Anyone who is authenticated can see the room list.
 * The room password hash is never sent to the client.
 */
async function listRooms(req, res, next) {
  try {
    const rooms = await Room.find()
      .sort({ createdAt: -1 })
      .populate('creator', 'username profilePic')
      .lean();

    const userId = req.user._id.toString();

    // Fetch all last-read records for this user in one query
    const roomIds = rooms.map((r) => r._id.toString());
    const readRecords = await UserRoomRead.find({
      userId: req.user._id,
      roomId: { $in: roomIds },
    }).lean();
    const readMap = {};
    readRecords.forEach((r) => { readMap[r.roomId] = r.lastReadAt; });

    // For each room, count messages newer than lastReadAt
    const Message = require('../models/Message');
    const unreadCounts = await Promise.all(
      rooms.map(async (r) => {
        const roomIdStr = r._id.toString();
        const lastRead = readMap[roomIdStr];
        if (!lastRead) return { roomId: roomIdStr, count: 0 };
        const count = await Message.countDocuments({
          room: roomIdStr,
          createdAt: { $gt: lastRead },
          deleted: { $ne: true },
        });
        return { roomId: roomIdStr, count };
      })
    );
    const unreadMap = {};
    unreadCounts.forEach(({ roomId, count }) => { unreadMap[roomId] = count; });

    const sanitized = rooms.map((r) => ({
      _id:          r._id,
      name:         r.name,
      status:       r.status,
      maxMembers:   r.maxMembers,
      memberCount:  r.members.length,
      creator:      r.creator,
      createdAt:    r.createdAt,
      isFull:       r.members.length >= r.maxMembers,
      unreadCount:  unreadMap[r._id.toString()] || 0,
    }));

    return res.json({ success: true, rooms: sanitized });
  } catch (err) {
    next(err);
  }
}

// ── Create Room ───────────────────────────────────────────────────────────────

/**
 * POST /api/rooms
 * Body: { name, status, password?, maxMembers }
 * Creates the room and automatically adds the creator as the first member.
 */
async function createRoom(req, res, next) {
  try {
    const { name, status, password, maxMembers } = req.body;

    // Validate room name
    const nameCheck = validateRoomName(name);
    if (!nameCheck.valid) {
      return res.status(400).json({ success: false, message: nameCheck.error });
    }

    // Validate status
    if (!['public', 'private'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be "public" or "private".' });
    }

    // Validate password for private rooms
    let passwordHash = null;
    if (status === 'private') {
      const pCheck = validateRoomPassword(password);
      if (!pCheck.valid) {
        return res.status(400).json({ success: false, message: pCheck.error });
      }
      passwordHash = await bcrypt.hash(password, 10);
    }

    // Validate maxMembers
    const max = parseInt(maxMembers, 10);
    if (isNaN(max) || max < 2 || max > 50) {
      return res.status(400).json({ success: false, message: 'Max members must be between 2 and 50.' });
    }

    // Check room name uniqueness (case-insensitive)
    const existing = await Room.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'A room with that name already exists.' });
    }

    const room = await Room.create({
      name:         name.trim(),
      creator:      req.user._id,
      status,
      passwordHash,
      maxMembers:   max,
      members:      [req.user._id], // Creator auto-joins
    });

    // Populate creator for the response
    await room.populate('creator', 'username profilePic');

    return res.status(201).json({
      success: true,
      room: {
        _id:         room._id,
        name:        room.name,
        status:      room.status,
        maxMembers:  room.maxMembers,
        memberCount: room.members.length,
        creator:     room.creator,
        createdAt:   room.createdAt,
        isFull:      false,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── Join Room ─────────────────────────────────────────────────────────────────

/**
 * POST /api/rooms/:id/join
 * Body (private rooms only): { password }
 *
 * Server-side checks: capacity + password (for private rooms) + ban status.
 * On success, adds the user to Room.members and returns room info.
 * The socket join happens separately when the client calls join-room over WS.
 */
async function joinRoom(req, res, next) {
  try {
    const room = await Room.findById(req.params.id);

    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    const userId = req.user._id.toString();

    // Check restriction/ban
    if (room.bannedUsers && room.bannedUsers.some((b) => b.toString() === userId)) {
      return res.status(403).json({ success: false, message: 'You have been restricted from entering this room by the host.' });
    }

    // Check capacity
    if (room.members.length >= room.maxMembers) {
      return res.status(403).json({ success: false, message: 'This room is full.' });
    }

    // Private room: verify password
    if (room.status === 'private') {
      const { password } = req.body;
      if (!password) {
        return res.status(400).json({ success: false, message: 'A password is required to join this room.' });
      }
      const match = await bcrypt.compare(password, room.passwordHash);
      if (!match) {
        return res.status(401).json({ success: false, message: 'Incorrect room password.' });
      }
    }

    // Add user to members if not already there
    const alreadyMember = room.members.some((m) => m.toString() === userId);
    if (!alreadyMember) {
      room.members.push(req.user._id);
      await room.save();
    }

    return res.json({
      success: true,
      room: {
        _id:  room._id,
        name: room.name,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── Leave Room ────────────────────────────────────────────────────────────────

/**
 * POST /api/rooms/:id/leave
 * Removes the user from Room.members.
 * Note: the creator leaving does NOT delete the room.
 */
async function leaveRoom(req, res, next) {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found.' });

    const userId = req.user._id.toString();
    room.members = room.members.filter((m) => m.toString() !== userId);
    await room.save();

    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/rooms/:id
 * Returns a single room's public details (no password hash).
 */
async function getRoom(req, res, next) {
  try {
    const room = await Room.findById(req.params.id)
      .populate('creator', 'username profilePic')
      .lean();

    if (!room) return res.status(404).json({ success: false, message: 'Room not found.' });

    const userId = req.user._id.toString();
    const isCreator = room.creator._id.toString() === userId;

    return res.json({
      success: true,
      room: {
        _id:         room._id,
        name:        room.name,
        status:      room.status,
        maxMembers:  room.maxMembers,
        memberCount: room.members.length,
        creator:     room.creator,
        createdAt:   room.createdAt,
        isFull:      room.members.length >= room.maxMembers,
        isCreator,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── Creator Management Endpoints ─────────────────────────────────────────────

const Message = require('../models/Message');
const User    = require('../models/User');

function ejectUserSockets(io, roomId, targetUserId, eventName, message) {
  if (!io) return;
  const roomIdStr = roomId.toString();
  const userIdStr = targetUserId.toString();

  const socketsInRoom = io.sockets.adapter.rooms.get(roomIdStr);
  if (socketsInRoom) {
    for (const socketId of socketsInRoom) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket && socket.user && socket.user._id.toString() === userIdStr) {
        socket.emit(eventName, { roomId: roomIdStr, message });
        socket.leave(roomIdStr);
        socket.currentRoomId = null;
      }
    }
  }
}

/**
 * DELETE /api/rooms/:id
 * Only room creator can delete the room.
 */
async function deleteRoom(req, res, next) {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found.' });

    if (room.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the room creator can delete this room.' });
    }

    const roomIdStr = room._id.toString();

    // Delete room document & persistent message history
    await Room.findByIdAndDelete(room._id);
    await Message.deleteMany({ room: roomIdStr });

    // Notify connected sockets in the room
    const io = req.app.get('io');
    if (io) {
      io.to(roomIdStr).emit('room-deleted', {
        roomId: roomIdStr,
        message: 'This room has been deleted by the host.',
      });
    }

    return res.json({ success: true, message: 'Room deleted successfully.' });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/rooms/:id/settings
 * Body: { name, status, password, maxMembers }
 * Only room creator can change settings/password.
 */
async function updateRoomSettings(req, res, next) {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found.' });

    if (room.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the room creator can update room settings.' });
    }

    const { name, status, password, maxMembers } = req.body;

    if (name && name.trim() !== room.name) {
      const nameCheck = validateRoomName(name);
      if (!nameCheck.valid) return res.status(400).json({ success: false, message: nameCheck.error });
      const existing = await Room.findOne({ _id: { $ne: room._id }, name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } });
      if (existing) return res.status(409).json({ success: false, message: 'A room with that name already exists.' });
      room.name = name.trim();
    }

    if (status && ['public', 'private'].includes(status)) {
      room.status = status;
      if (status === 'public') {
        room.passwordHash = null;
      }
    }

    if (room.status === 'private' && password) {
      const pCheck = validateRoomPassword(password);
      if (!pCheck.valid) return res.status(400).json({ success: false, message: pCheck.error });
      room.passwordHash = await bcrypt.hash(password, 10);
    }

    if (maxMembers) {
      const max = parseInt(maxMembers, 10);
      if (isNaN(max) || max < 2 || max > 50) {
        return res.status(400).json({ success: false, message: 'Max members must be between 2 and 50.' });
      }
      room.maxMembers = max;
    }

    await room.save();

    // Broadcast room-updated to socket room
    const io = req.app.get('io');
    if (io) {
      io.to(room._id.toString()).emit('room-updated', {
        roomId: room._id.toString(),
        name: room.name,
        status: room.status,
        maxMembers: room.maxMembers,
      });
    }

    return res.json({
      success: true,
      room: {
        _id: room._id,
        name: room.name,
        status: room.status,
        maxMembers: room.maxMembers,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/rooms/:id/kick
 * Body: { targetUserId }
 * Creator kicks a member from the room.
 */
async function kickMember(req, res, next) {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found.' });

    if (room.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the room creator can kick members.' });
    }

    const { targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ success: false, message: 'Target user ID is required.' });

    if (targetUserId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot kick yourself.' });
    }

    // Remove from DB members
    room.members = room.members.filter((m) => m.toString() !== targetUserId);
    await room.save();

    // Eject target user's active sockets
    const io = req.app.get('io');
    ejectUserSockets(io, room._id, targetUserId, 'kicked-from-room', 'You were kicked from the room by the host.');

    const targetUser = await User.findById(targetUserId, 'username').lean();
    const kickedUsername = targetUser ? targetUser.username : 'A user';

    if (io) {
      io.to(room._id.toString()).emit('user-left', {
        username: kickedUsername,
        roomId: room._id.toString(),
        message: `${kickedUsername} was kicked by the host.`,
        createdAt: new Date(),
      });
    }

    return res.json({ success: true, message: `${kickedUsername} has been kicked.` });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/rooms/:id/ban
 * Body: { targetUserId }
 * Creator restricts/bans a member from entering the room.
 */
async function banMember(req, res, next) {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found.' });

    if (room.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the room creator can restrict members.' });
    }

    const { targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ success: false, message: 'Target user ID is required.' });

    if (targetUserId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot restrict yourself.' });
    }

    // Add to bannedUsers if not already present
    if (!room.bannedUsers.some((b) => b.toString() === targetUserId)) {
      room.bannedUsers.push(targetUserId);
    }
    // Remove from members
    room.members = room.members.filter((m) => m.toString() !== targetUserId);
    await room.save();

    // Eject target user's active sockets
    const io = req.app.get('io');
    ejectUserSockets(io, room._id, targetUserId, 'banned-from-room', 'You have been restricted from entering this room by the host.');

    const targetUser = await User.findById(targetUserId, 'username').lean();
    const bannedUsername = targetUser ? targetUser.username : 'A user';

    if (io) {
      io.to(room._id.toString()).emit('user-left', {
        username: bannedUsername,
        roomId: room._id.toString(),
        message: `${bannedUsername} was restricted from the room by the host.`,
        createdAt: new Date(),
      });
    }

    return res.json({ success: true, message: `${bannedUsername} has been restricted from this room.` });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/rooms/:id/unban
 * Body: { targetUserId }
 * Creator removes restriction for a user.
 */
async function unbanMember(req, res, next) {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found.' });

    if (room.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the room creator can lift restrictions.' });
    }

    const { targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ success: false, message: 'Target user ID is required.' });

    room.bannedUsers = room.bannedUsers.filter((b) => b.toString() !== targetUserId);
    await room.save();

    return res.json({ success: true, message: 'Restriction lifted.' });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/rooms/:id/banned
 * List restricted users for a room (creator only).
 */
async function getBannedUsers(req, res, next) {
  try {
    const room = await Room.findById(req.params.id).populate('bannedUsers', 'username name profilePic');
    if (!room) return res.status(404).json({ success: false, message: 'Room not found.' });

    if (room.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the room creator can view restricted users.' });
    }

    return res.json({ success: true, bannedUsers: room.bannedUsers });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/rooms/:id/unread
 * Returns the number of unread messages in the room for the current user.
 */
async function getUnreadCount(req, res, next) {
  try {
    const Message = require('../models/Message');
    const roomId  = req.params.id;
    const record  = await UserRoomRead.findOne({ userId: req.user._id, roomId }).lean();

    if (!record) return res.json({ success: true, unreadCount: 0 });

    const count = await Message.countDocuments({
      room:      roomId,
      createdAt: { $gt: record.lastReadAt },
      deleted:   { $ne: true },
    });

    return res.json({ success: true, unreadCount: count });
  } catch (err) {
    next(err);
  }
}

module.exports = {
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
  getUnreadCount,
};

