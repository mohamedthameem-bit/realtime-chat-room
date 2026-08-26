/**
 * messageActionsController.js — Edit, delete, and react to messages (Phase 5).
 */

const Message = require('../models/Message');
const Room    = require('../models/Room');

const ALLOWED_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

// ── Edit Message ─────────────────────────────────────────────────────────────

/**
 * PATCH /api/messages/:id
 * Body: { message: string }
 * Only the original sender can edit their message.
 */
async function editMessage(req, res, next) {
  try {
    const msg = await Message.findById(req.params.id);
    if (!msg) return res.status(404).json({ success: false, message: 'Message not found.' });
    if (msg.deleted) return res.status(400).json({ success: false, message: 'Cannot edit a deleted message.' });

    // Only the sender can edit
    if (!msg.userId || msg.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only edit your own messages.' });
    }

    const newText = (req.body.message || '').trim();
    if (!newText || newText.length > 500) {
      return res.status(400).json({ success: false, message: 'Message must be between 1 and 500 characters.' });
    }

    msg.message  = newText;
    msg.edited   = true;
    msg.editedAt = new Date();
    await msg.save();

    // Broadcast via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(msg.room).emit('message-edited', {
        _id:      msg._id.toString(),
        message:  msg.message,
        editedAt: msg.editedAt,
      });
    }

    return res.json({ success: true, message: 'Message updated.', msg: { _id: msg._id, message: msg.message, editedAt: msg.editedAt } });
  } catch (err) {
    next(err);
  }
}

// ── Delete Message ────────────────────────────────────────────────────────────

/**
 * DELETE /api/messages/:id
 * The original sender OR the room creator can delete a message.
 */
async function deleteMessage(req, res, next) {
  try {
    const msg = await Message.findById(req.params.id);
    if (!msg) return res.status(404).json({ success: false, message: 'Message not found.' });
    if (msg.deleted) return res.status(400).json({ success: false, message: 'Message already deleted.' });

    const userId = req.user._id.toString();
    const isAuthor = msg.userId && msg.userId.toString() === userId;

    // Check if user is the room creator
    let isRoomCreator = false;
    if (!isAuthor) {
      const room = await Room.findOne({ _id: msg.room }).lean().catch(() => null);
      if (!room) {
        // Try treating msg.room as room id string — find room by _id toString
        const room2 = await Room.findById(msg.room).lean().catch(() => null);
        if (room2 && room2.creator.toString() === userId) isRoomCreator = true;
      } else {
        if (room.creator.toString() === userId) isRoomCreator = true;
      }
    }

    if (!isAuthor && !isRoomCreator) {
      return res.status(403).json({ success: false, message: 'You do not have permission to delete this message.' });
    }

    msg.deleted   = true;
    msg.deletedAt = new Date();
    msg.message   = '[deleted]'; // Overwrite for any future REST fallback
    msg.reactions = [];
    await msg.save();

    // Broadcast via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(msg.room).emit('message-deleted', { _id: msg._id.toString() });
    }

    return res.json({ success: true, message: 'Message deleted.' });
  } catch (err) {
    next(err);
  }
}

// ── React to Message ──────────────────────────────────────────────────────────

/**
 * POST /api/messages/:id/react
 * Body: { emoji: string }
 * Toggles the user's reaction on a message.
 */
async function reactToMessage(req, res, next) {
  try {
    const msg = await Message.findById(req.params.id);
    if (!msg) return res.status(404).json({ success: false, message: 'Message not found.' });
    if (msg.deleted) return res.status(400).json({ success: false, message: 'Cannot react to a deleted message.' });

    const { emoji } = req.body;
    if (!emoji || !ALLOWED_EMOJIS.includes(emoji)) {
      return res.status(400).json({ success: false, message: 'Invalid emoji.' });
    }

    const userId = req.user._id;
    const userIdStr = userId.toString();

    // Find existing reaction bucket for this emoji
    let bucket = msg.reactions.find((r) => r.emoji === emoji);

    if (bucket) {
      const alreadyReacted = bucket.users.some((u) => u.toString() === userIdStr);
      if (alreadyReacted) {
        // Toggle off
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

    // Build a clean serializable reactions payload
    const reactionsPayload = msg.reactions.map((r) => ({
      emoji: r.emoji,
      count: r.users.length,
      users: r.users.map((u) => u.toString()),
    }));

    // Broadcast via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(msg.room).emit('message-reacted', {
        _id:       msg._id.toString(),
        reactions: reactionsPayload,
      });
    }

    return res.json({ success: true, reactions: reactionsPayload });
  } catch (err) {
    next(err);
  }
}

module.exports = { editMessage, deleteMessage, reactToMessage };
