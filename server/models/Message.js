/**
 * Message.js — Mongoose model for chat messages (Phase 5 extended).
 */

const mongoose = require('mongoose');

const reactionSchema = new mongoose.Schema({
  emoji: { type: String, required: true },
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { _id: false });

const messageSchema = new mongoose.Schema(
  {
    // ── Core fields ──────────────────────────────────────────────────────────
    username: {
      type: String,
      required: [true, 'Username is required'],
      trim: true,
      maxlength: [30, 'Username cannot exceed 30 characters'],
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    message: {
      type: String,
      required: [true, 'Message content is required'],
      trim: true,
      maxlength: [500, 'Message cannot exceed 500 characters'],
    },
    room: {
      type: String,
      trim: true,
      lowercase: true,
      default: 'general',
      // In Phase 6, room is optional if conversationId is set
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
    },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdAt: {
      type: Date,
      default: Date.now,
    },

    // ── Phase 5: Edit & Delete ───────────────────────────────────────────────
    edited: { type: Boolean, default: false },
    editedAt: { type: Date },
    deleted: { type: Boolean, default: false },
    deletedAt: { type: Date },

    // ── Phase 5: Reply to message ────────────────────────────────────────────
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    // Snapshot of reply-to message data (so deleted replies still show context)
    replySnapshot: {
      username: String,
      message: String,
    },

    // ── Phase 5: Reactions ───────────────────────────────────────────────────
    reactions: {
      type: [reactionSchema],
      default: [],
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// Compound index for fast "recent messages for a room" queries
messageSchema.index({ room: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
