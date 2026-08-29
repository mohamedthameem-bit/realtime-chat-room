/**
 * Conversation.js — Mongoose model for Direct Messaging conversations (Phase 6).
 */

const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
    isGroup: { type: Boolean, default: false },
    groupName: String,
    groupIcon: String,
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    disappearingMessages: { type: Boolean, default: false },
    pinnedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    mutedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// Index for quickly finding conversations for a user
conversationSchema.index({ participants: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);
