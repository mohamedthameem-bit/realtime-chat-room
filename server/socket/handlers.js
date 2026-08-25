/**
 * handlers.js — Socket.IO event logic and in-memory presence tracking (Phase 2).
 *
 * Changes from Phase 1:
 *  - Identity comes from socket.user (set by socketAuth middleware) — NOT from client payload
 *  - join-room now takes { roomId } and looks up the Room in MongoDB
 *  - send-message uses socket.user.username — no client-supplied username
 *  - removeFromRoom also removes user from Room.members in DB
 *  - Duplicate username handling removed (users have unique accounts now)
 *
 * Presence data structure (unchanged):
 *   rooms: Map<roomId, Map<socketId, { username, userId }>>
 */

const Message = require('../models/Message');
const Room    = require('../models/Room');
const { validateMessage } = require('../middleware/validate');

// In-memory store: roomId (string) → Map<socketId, { username, userId }>
const rooms = new Map();

/**
 * Get the list of user objects currently in a room (for the online users panel).
 * Returns: Array<{ username, profilePic }>
 */
function getUsersInRoom(roomId) {
  const roomMap = rooms.get(roomId);
  if (!roomMap) return [];
  return Array.from(roomMap.values());
}

/**
 * Remove a socket from the in-memory presence map AND from Room.members in DB.
 * Broadcasts user-left + updated online-users to the room.
 */
async function removeFromRoom(io, socket) {
  const { currentRoomId: roomId, currentUsername: username } = socket;
  if (!roomId || !username) return;

  // Remove from in-memory presence
  const roomMap = rooms.get(roomId);
  if (roomMap) {
    roomMap.delete(socket.id);
    if (roomMap.size === 0) rooms.delete(roomId);
  }

  // Remove from DB members array
  try {
    await Room.findByIdAndUpdate(roomId, {
      $pull: { members: socket.user._id },
    });
  } catch (err) {
    console.error('[Socket] Failed to update room members on leave:', err.message);
  }

  const onlineUsers = getUsersInRoom(roomId);

  io.to(roomId).emit('user-left', {
    username,
    roomId,
    message: `${username} has left the room.`,
    createdAt: new Date(),
  });

  io.to(roomId).emit('online-users', { roomId, users: onlineUsers });

  console.log(`[Socket] ${username} left room "${roomId}". Online: ${onlineUsers.length}`);
}

/**
 * Register all Socket.IO event handlers for a single authenticated socket.
 * socket.user is guaranteed to be set by socketAuth middleware.
 */
function registerHandlers(io, socket) {
  const { username, _id: userId, profilePic } = socket.user;
  console.log(`[Socket] Authenticated connection: ${username} (${socket.id})`);

  // ------------------------------------------------------------------
  // join-room
  // Client sends: { roomId: string }
  // ------------------------------------------------------------------
  socket.on('join-room', async ({ roomId } = {}) => {
    if (!roomId) {
      socket.emit('error-message', { error: 'Room ID is required.' });
      return;
    }

    // Verify the room exists and the user is a member (join must happen via REST first)
    let room;
    try {
      room = await Room.findById(roomId).lean();
    } catch (_) {
      socket.emit('error-message', { error: 'Invalid room ID.' });
      return;
    }

    if (!room) {
      socket.emit('error-message', { error: 'Room not found.' });
      return;
    }

    // Check that the user has been admitted via the REST /join endpoint
    const isMember = room.members.some((m) => m.toString() === userId.toString());
    if (!isMember) {
      socket.emit('error-message', { error: 'You must join the room first.' });
      return;
    }

    // Check if restricted/banned
    if (room.bannedUsers && room.bannedUsers.some((b) => b.toString() === userId.toString())) {
      socket.emit('error-message', { error: 'You have been restricted from entering this room by the host.' });
      return;
    }


    const roomIdStr = roomId.toString();

    // Leave any previously joined room first
    if (socket.currentRoomId && socket.currentRoomId !== roomIdStr) {
      await removeFromRoom(io, socket);
      socket.leave(socket.currentRoomId);
    }

    // Register presence
    if (!rooms.has(roomIdStr)) {
      rooms.set(roomIdStr, new Map());
    }
    rooms.get(roomIdStr).set(socket.id, {
      username,
      userId: userId.toString(),
      profilePic: profilePic || '',
    });

    socket.currentRoomId    = roomIdStr;
    socket.currentRoomName  = room.name;
    socket.currentUsername  = username;

    socket.join(roomIdStr);
    console.log(`[Socket] ${username} joined room "${room.name}" (${roomIdStr})`);

    // Send message history (last 50, oldest → newest)
    try {
      const recentMessages = await Message.find({ room: roomIdStr })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      socket.emit('recent-messages', recentMessages.reverse());
    } catch (err) {
      console.error('[Socket] Failed to load recent messages:', err.message);
      socket.emit('recent-messages', []);
    }

    // Broadcast join event to everyone else
    socket.to(roomIdStr).emit('user-joined', {
      username,
      roomId: roomIdStr,
      message: `${username} has joined the room.`,
      createdAt: new Date(),
    });

    // Send updated online users list to everyone
    const onlineUsers = getUsersInRoom(roomIdStr);
    io.to(roomIdStr).emit('online-users', { roomId: roomIdStr, users: onlineUsers });
  });

  // ------------------------------------------------------------------
  // send-message
  // Client sends: { message: string }
  // ------------------------------------------------------------------
  socket.on('send-message', async ({ message } = {}) => {
    if (!socket.currentRoomId) {
      socket.emit('error-message', { error: 'You must join a room before sending messages.' });
      return;
    }

    const msgCheck = validateMessage(message);
    if (!msgCheck.valid) {
      socket.emit('error-message', { error: msgCheck.error });
      return;
    }

    const trimmedMessage = message.trim();
    const roomId = socket.currentRoomId;

    try {
      // Persist — store roomId (not room name) so queries are consistent
      const saved = await Message.create({
        username,                // String snapshot at send-time
        message: trimmedMessage,
        room:    roomId,
        createdAt: new Date(),
      });

      const payload = {
        username:   saved.username,
        message:    saved.message,
        room:       saved.room,
        createdAt:  saved.createdAt,
        profilePic: profilePic || '',
      };

      io.to(roomId).emit('receive-message', payload);
    } catch (err) {
      console.error('[Socket] Failed to save message:', err.message);
      socket.emit('error-message', { error: 'Failed to send message. Please try again.' });
    }
  });

  // ------------------------------------------------------------------
  // typing / stop-typing
  // ------------------------------------------------------------------
  socket.on('typing', () => {
    if (socket.currentRoomId) {
      socket.to(socket.currentRoomId).emit('typing', { username });
    }
  });

  socket.on('stop-typing', () => {
    if (socket.currentRoomId) {
      socket.to(socket.currentRoomId).emit('stop-typing', { username });
    }
  });

  // ------------------------------------------------------------------
  // leave-room (explicit button click)
  // ------------------------------------------------------------------
  socket.on('leave-room', async () => {
    await removeFromRoom(io, socket);
    if (socket.currentRoomId) socket.leave(socket.currentRoomId);
    socket.currentRoomId   = null;
    socket.currentRoomName = null;
    socket.currentUsername = null;
  });

  // ------------------------------------------------------------------
  // disconnect (tab close, network drop, etc.)
  // ------------------------------------------------------------------
  socket.on('disconnect', async (reason) => {
    console.log(`[Socket] Disconnected: ${username} (${socket.id}) — reason: ${reason}`);
    await removeFromRoom(io, socket);
  });
}

module.exports = { registerHandlers };
