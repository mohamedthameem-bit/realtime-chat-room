/**
 * handlers.js — Socket.IO event logic (Phase 6).
 */

const Message = require('../models/Message');
const Room = require('../models/Room');
const UserRoomRead = require('../models/UserRoomRead');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const { validateMessage } = require('../middleware/validate');

const ALLOWED_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

// In-memory store for room presences: roomId (string) → Map<socketId, { username, userId }>
const rooms = new Map();

function getUsersInRoom(roomId) {
  const roomMap = rooms.get(roomId);
  if (!roomMap) return [];
  return Array.from(roomMap.values());
}

async function removeFromRoom(io, socket) {
  const { currentRoomId: roomId, currentUsername: username } = socket;
  if (!roomId || !username) return;

  const roomMap = rooms.get(roomId);
  if (roomMap) {
    roomMap.delete(socket.id);
    if (roomMap.size === 0) rooms.delete(roomId);
  }

  try {
    await Room.findByIdAndUpdate(roomId, { $pull: { members: socket.user._id } });
  } catch (err) {}

  const onlineUsers = getUsersInRoom(roomId);
  io.to(roomId).emit('user-left', {
    username,
    roomId,
    message: `${username} has left the room.`,
    createdAt: new Date(),
  });
  io.to(roomId).emit('online-users', { roomId, users: onlineUsers });
}

function registerHandlers(io, socket) {
  const { username, _id: userId, profilePic } = socket.user;
  const userIdStr = userId.toString();

  // Phase 6: Global user tracking
  // Join a personal room to receive DMs and friend requests
  socket.join(`user:${userIdStr}`);

  // Broadcast that this user is online (only if they are not set to invisible)
  if (socket.user.status !== 'invisible') {
    io.emit('user-status-changed', { userId: userIdStr, status: socket.user.status });
  }

  socket.on('join-room', async ({ roomId } = {}) => {
    if (!roomId) return socket.emit('error-message', { error: 'Room ID is required.' });

    let room;
    try { room = await Room.findById(roomId).lean(); } catch (_) { return socket.emit('error-message', { error: 'Invalid room ID.' }); }
    if (!room) return socket.emit('error-message', { error: 'Room not found.' });

    const isMember = room.members.some((m) => m.toString() === userIdStr);
    if (!isMember) return socket.emit('error-message', { error: 'You must join the room first.' });
    if (room.bannedUsers && room.bannedUsers.some((b) => b.toString() === userIdStr)) {
      return socket.emit('error-message', { error: 'Restricted from this room.' });
    }

    const roomIdStr = roomId.toString();
    if (socket.currentRoomId && socket.currentRoomId !== roomIdStr) {
      await removeFromRoom(io, socket);
      socket.leave(socket.currentRoomId);
    }

    if (!rooms.has(roomIdStr)) rooms.set(roomIdStr, new Map());
    rooms.get(roomIdStr).set(socket.id, { username, userId: userIdStr, profilePic: profilePic || '' });

    socket.currentRoomId = roomIdStr;
    socket.currentRoomName = room.name;
    socket.currentUsername = username;
    socket.join(roomIdStr);

    try {
      await UserRoomRead.findOneAndUpdate({ userId, roomId: roomIdStr }, { lastReadAt: new Date() }, { upsert: true });
      const recentMessages = await Message.find({ room: roomIdStr }).sort({ createdAt: -1 }).limit(50).lean();
      socket.emit('recent-messages', recentMessages.reverse());
    } catch (err) {}

    socket.to(roomIdStr).emit('user-joined', { username, roomId: roomIdStr, message: `${username} has joined.`, createdAt: new Date() });
    io.to(roomIdStr).emit('online-users', { roomId: roomIdStr, users: getUsersInRoom(roomIdStr) });
  });

  socket.on('send-message', async ({ message, replyToId } = {}) => {
    if (!socket.currentRoomId) return socket.emit('error-message', { error: 'Must join a room.' });
    const msgCheck = validateMessage(message);
    if (!msgCheck.valid) return socket.emit('error-message', { error: msgCheck.error });

    const roomId = socket.currentRoomId;
    try {
      const msgData = { username, userId, message: message.trim(), room: roomId, createdAt: new Date() };
      if (replyToId) {
        const parent = await Message.findById(replyToId).lean();
        if (parent && !parent.deleted) {
          msgData.replyTo = parent._id;
          msgData.replySnapshot = { username: parent.username, message: parent.message };
        }
      }
      const saved = await Message.create(msgData);
      io.to(roomId).emit('receive-message', { ...saved.toObject(), profilePic: profilePic || '' });
    } catch (err) {}
  });

  // Phase 6: Direct Messaging
  socket.on('join-dm', async ({ conversationId }) => {
    if (!conversationId) return;
    try {
      const conv = await Conversation.findById(conversationId).lean();
      if (conv && conv.participants.some(p => p.toString() === userIdStr)) {
        socket.join(`dm:${conversationId}`);
        socket.currentDmId = conversationId;
      }
    } catch (err) {}
  });

  socket.on('send-dm', async ({ conversationId, message, replyToId }) => {
    if (!conversationId) return;
    const msgCheck = validateMessage(message);
    if (!msgCheck.valid) return socket.emit('error-message', { error: msgCheck.error });

    try {
      const conv = await Conversation.findById(conversationId).lean();
      if (!conv || !conv.participants.some(p => p.toString() === userIdStr)) return;

      const msgData = {
        username,
        userId,
        message: message.trim(),
        conversationId,
        readBy: [userId], // I have read my own message
        createdAt: new Date()
      };

      if (replyToId) {
        const parent = await Message.findById(replyToId).lean();
        if (parent && !parent.deleted) {
          msgData.replyTo = parent._id;
          msgData.replySnapshot = { username: parent.username, message: parent.message };
        }
      }
      const saved = await Message.create(msgData);
      
      const payload = {
        ...saved.toObject(),
        profilePic: profilePic || ''
      };

      // Emit to the DM room
      io.to(`dm:${conversationId}`).emit('receive-dm', payload);

      // Also emit to user's personal rooms to update unread badges
      conv.participants.forEach(p => {
        io.to(`user:${p.toString()}`).emit('dm-notification', payload);
      });
    } catch (err) {}
  });


  socket.on('edit-message', async ({ messageId, newText } = {}) => {
    const text = (newText || '').trim();
    if (!text || text.length > 500) return;
    try {
      const msg = await Message.findById(messageId);
      if (!msg || msg.deleted || msg.userId.toString() !== userIdStr) return;
      msg.message = text; msg.edited = true; msg.editedAt = new Date(); await msg.save();
      const target = msg.room ? msg.room : `dm:${msg.conversationId}`;
      io.to(target).emit('message-edited', { _id: msg._id.toString(), message: msg.message, editedAt: msg.editedAt });
    } catch (err) {}
  });

  socket.on('delete-message', async ({ messageId } = {}) => {
    try {
      const msg = await Message.findById(messageId);
      if (!msg || msg.deleted) return;
      
      const isAuthor = msg.userId && msg.userId.toString() === userIdStr;
      let isRoomCreator = false;
      if (!isAuthor && msg.room) {
        const room = await Room.findById(msg.room).lean();
        if (room && room.creator.toString() === userIdStr) isRoomCreator = true;
      }
      if (!isAuthor && !isRoomCreator) return;
      
      msg.deleted = true; msg.deletedAt = new Date(); msg.reactions = []; await msg.save();
      const target = msg.room ? msg.room : `dm:${msg.conversationId}`;
      io.to(target).emit('message-deleted', { _id: msg._id.toString() });
    } catch (err) {}
  });

  socket.on('react-message', async ({ messageId, emoji } = {}) => {
    if (!emoji || !ALLOWED_EMOJIS.includes(emoji)) return;
    try {
      const msg = await Message.findById(messageId);
      if (!msg || msg.deleted) return;
      
      let bucket = msg.reactions.find((r) => r.emoji === emoji);
      if (bucket) {
        if (bucket.users.some((u) => u.toString() === userIdStr)) {
          bucket.users = bucket.users.filter((u) => u.toString() !== userIdStr);
          if (bucket.users.length === 0) msg.reactions = msg.reactions.filter((r) => r.emoji !== emoji);
        } else bucket.users.push(userId);
      } else msg.reactions.push({ emoji, users: [userId] });
      
      msg.markModified('reactions'); await msg.save();
      const target = msg.room ? msg.room : `dm:${msg.conversationId}`;
      io.to(target).emit('message-reacted', { _id: msg._id.toString(), reactions: msg.reactions.map(r => ({ emoji: r.emoji, count: r.users.length, users: r.users.map(u => u.toString()) })) });
    } catch (err) {}
  });

  // ── Phase 7: WebRTC Voice Calls Signaling ──

  // 1-on-1 DM Calling
  socket.on('dm-call-offer', ({ targetUserId, offer }) => {
    io.to(`user:${targetUserId}`).emit('dm-call-incoming', { callerId: userIdStr, callerName: username, offer });
  });
  socket.on('dm-call-answer', ({ targetUserId, answer }) => {
    io.to(`user:${targetUserId}`).emit('dm-call-answered', { answer });
  });
  socket.on('dm-call-ice-candidate', ({ targetUserId, candidate }) => {
    io.to(`user:${targetUserId}`).emit('dm-call-ice-candidate', { candidate });
  });
  socket.on('dm-call-rejected', ({ targetUserId }) => {
    io.to(`user:${targetUserId}`).emit('dm-call-rejected');
  });
  socket.on('dm-call-ended', ({ targetUserId }) => {
    io.to(`user:${targetUserId}`).emit('dm-call-ended');
  });

  // Group Room Voice Mesh Networking
  socket.on('join-voice', () => {
    if (!socket.currentRoomId) return;
    socket.inVoiceRoom = true;
    socket.to(socket.currentRoomId).emit('user-joined-voice', { userId: userIdStr, username, profilePic: profilePic || '' });
  });
  socket.on('leave-voice', () => {
    if (!socket.currentRoomId) return;
    socket.inVoiceRoom = false;
    socket.to(socket.currentRoomId).emit('user-left-voice', { userId: userIdStr });
  });
  socket.on('room-voice-offer', ({ targetUserId, offer }) => {
    io.to(`user:${targetUserId}`).emit('room-voice-offer', { callerId: userIdStr, callerName: username, offer });
  });
  socket.on('room-voice-answer', ({ targetUserId, answer }) => {
    io.to(`user:${targetUserId}`).emit('room-voice-answer', { answererId: userIdStr, answer });
  });
  socket.on('room-voice-ice-candidate', ({ targetUserId, candidate }) => {
    io.to(`user:${targetUserId}`).emit('room-voice-ice-candidate', { senderId: userIdStr, candidate });
  });

  socket.on('typing', () => {
    if (socket.currentRoomId) socket.to(socket.currentRoomId).emit('typing', { username });
    if (socket.currentDmId) socket.to(`dm:${socket.currentDmId}`).emit('typing', { username });
  });

  socket.on('stop-typing', () => {
    if (socket.currentRoomId) socket.to(socket.currentRoomId).emit('stop-typing', { username });
    if (socket.currentDmId) socket.to(`dm:${socket.currentDmId}`).emit('stop-typing', { username });
  });

  socket.on('leave-room', async () => {
    await removeFromRoom(io, socket);
    if (socket.currentRoomId) {
      if (socket.inVoiceRoom) {
        socket.to(socket.currentRoomId).emit('user-left-voice', { userId: userIdStr });
        socket.inVoiceRoom = false;
      }
      socket.leave(socket.currentRoomId);
    }
    socket.currentRoomId = null; socket.currentRoomName = null; socket.currentUsername = null;
  });

  socket.on('disconnect', async () => {
    if (socket.inVoiceRoom && socket.currentRoomId) {
      socket.to(socket.currentRoomId).emit('user-left-voice', { userId: userIdStr });
    }
    await removeFromRoom(io, socket);
    // Let clients know they went offline (if they were online)
    if (socket.user.status !== 'invisible') {
       // Ideally we check if they have other active sockets, but for simplicity we just emit
       io.emit('user-status-changed', { userId: userIdStr, status: 'offline' });
    }
  });
}

module.exports = { registerHandlers };
