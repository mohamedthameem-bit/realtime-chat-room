/**
 * handlers.js — Socket.IO event logic and in-memory presence tracking (Phase 5).
 *
 * Phase 5 additions:
 *  - send-message now saves userId and replyTo + replySnapshot
 *  - New events: edit-message, delete-message, react-message
 *  - join-room updates UserRoomRead timestamp
 */

const Message      = require('../models/Message');
const Room         = require('../models/Room');
const UserRoomRead = require('../models/UserRoomRead');
const { validateMessage } = require('../middleware/validate');

const ALLOWED_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

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

    // Update last-read timestamp so unread count resets
    try {
      await UserRoomRead.findOneAndUpdate(
        { userId, roomId: roomIdStr },
        { lastReadAt: new Date() },
        { upsert: true, new: true }
      );
    } catch (err) {
      console.error('[Socket] Failed to update UserRoomRead:', err.message);
    }

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
  // Client sends: { message: string, replyToId?: string }
  // ------------------------------------------------------------------
  socket.on('send-message', async ({ message, replyToId } = {}) => {
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
      // Build message document
      const msgData = {
        username,
        userId,
        message: trimmedMessage,
        room:    roomId,
        createdAt: new Date(),
      };

      // Handle reply-to
      if (replyToId) {
        const parent = await Message.findById(replyToId).lean();
        if (parent && !parent.deleted) {
          msgData.replyTo = parent._id;
          msgData.replySnapshot = {
            username: parent.username,
            message:  parent.deleted ? '[deleted]' : parent.message,
          };
        }
      }

      const saved = await Message.create(msgData);

      const payload = {
        _id:           saved._id.toString(),
        username:      saved.username,
        userId:        saved.userId ? saved.userId.toString() : null,
        message:       saved.message,
        room:          saved.room,
        createdAt:     saved.createdAt,
        profilePic:    profilePic || '',
        replySnapshot: saved.replySnapshot || null,
        reactions:     [],
      };

      io.to(roomId).emit('receive-message', payload);
    } catch (err) {
      console.error('[Socket] Failed to save message:', err.message);
      socket.emit('error-message', { error: 'Failed to send message. Please try again.' });
    }
  });

  // ------------------------------------------------------------------
  // edit-message  (via socket for instant feedback)
  // Client sends: { messageId: string, newText: string }
  // ------------------------------------------------------------------
  socket.on('edit-message', async ({ messageId, newText } = {}) => {
    if (!socket.currentRoomId) return;

    const text = (newText || '').trim();
    if (!text || text.length > 500) {
      socket.emit('error-message', { error: 'Message must be 1–500 characters.' });
      return;
    }

    try {
      const msg = await Message.findById(messageId);
      if (!msg || msg.deleted) return;
      if (!msg.userId || msg.userId.toString() !== userId.toString()) {
        socket.emit('error-message', { error: 'You can only edit your own messages.' });
        return;
      }

      msg.message  = text;
      msg.edited   = true;
      msg.editedAt = new Date();
      await msg.save();

      io.to(socket.currentRoomId).emit('message-edited', {
        _id:      msg._id.toString(),
        message:  msg.message,
        editedAt: msg.editedAt,
      });
    } catch (err) {
      console.error('[Socket] Failed to edit message:', err.message);
    }
  });

  // ------------------------------------------------------------------
  // delete-message (via socket for instant feedback)
  // Client sends: { messageId: string }
  // ------------------------------------------------------------------
  socket.on('delete-message', async ({ messageId } = {}) => {
    if (!socket.currentRoomId) return;

    try {
      const msg = await Message.findById(messageId);
      if (!msg || msg.deleted) return;

      const isAuthor = msg.userId && msg.userId.toString() === userId.toString();
      let isRoomCreator = false;

      if (!isAuthor) {
        const room = await Room.findById(socket.currentRoomId).lean();
        if (room && room.creator.toString() === userId.toString()) isRoomCreator = true;
      }

      if (!isAuthor && !isRoomCreator) {
        socket.emit('error-message', { error: 'You do not have permission to delete this message.' });
        return;
      }

      msg.deleted   = true;
      msg.deletedAt = new Date();
      msg.reactions = [];
      await msg.save();

      io.to(socket.currentRoomId).emit('message-deleted', { _id: msg._id.toString() });
    } catch (err) {
      console.error('[Socket] Failed to delete message:', err.message);
    }
  });

  // ------------------------------------------------------------------
  // react-message
  // Client sends: { messageId: string, emoji: string }
  // ------------------------------------------------------------------
  socket.on('react-message', async ({ messageId, emoji } = {}) => {
    if (!socket.currentRoomId) return;
    if (!emoji || !ALLOWED_EMOJIS.includes(emoji)) return;

    try {
      const msg = await Message.findById(messageId);
      if (!msg || msg.deleted) return;

      const userIdStr = userId.toString();
      let bucket = msg.reactions.find((r) => r.emoji === emoji);

      if (bucket) {
        const alreadyReacted = bucket.users.some((u) => u.toString() === userIdStr);
        if (alreadyReacted) {
          bucket.users = bucket.users.filter((u) => u.toString() !== userIdStr);
          if (bucket.users.length === 0) {
            msg.reactions = msg.reactions.filter((r) => r.emoji !== emoji);
          }
        } else {
          bucket.users.push(userId);
        }
      } else {
        msg.reactions.push({ emoji, users: [userId] });
      }

      msg.markModified('reactions');
      await msg.save();

      const reactionsPayload = msg.reactions.map((r) => ({
        emoji: r.emoji,
        count: r.users.length,
        users: r.users.map((u) => u.toString()),
      }));

      io.to(socket.currentRoomId).emit('message-reacted', {
        _id:       msg._id.toString(),
        reactions: reactionsPayload,
      });
    } catch (err) {
      console.error('[Socket] Failed to react to message:', err.message);
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
