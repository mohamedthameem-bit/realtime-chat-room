/**
 * UserRoomRead.js — Tracks the last time a user read messages in a room.
 * Used for unread message badge counts on the rooms list page.
 */

const mongoose = require('mongoose');

const userRoomReadSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    roomId: {
      type: String,
      required: true,
    },
    lastReadAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false, versionKey: false }
);

// Compound unique index: one record per user per room
userRoomReadSchema.index({ userId: 1, roomId: 1 }, { unique: true });

module.exports = mongoose.model('UserRoomRead', userRoomReadSchema);
