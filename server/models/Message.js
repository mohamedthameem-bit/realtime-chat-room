/**
 * Message.js — Mongoose model for chat messages.
 */

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      trim: true,
      maxlength: [30, 'Username cannot exceed 30 characters'],
    },
    message: {
      type: String,
      required: [true, 'Message content is required'],
      trim: true,
      maxlength: [500, 'Message cannot exceed 500 characters'],
    },
    room: {
      type: String,
      required: [true, 'Room name is required'],
      trim: true,
      lowercase: true,
      default: 'general',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    // Disable the default timestamps so our custom createdAt is the single source of truth
    timestamps: false,
    versionKey: false,
  }
);

// Compound index for fast "recent messages for a room" queries
messageSchema.index({ room: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
