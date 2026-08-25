/**
 * Room.js — Mongoose model for chat rooms.
 */

const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Room name is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Room name must be at least 3 characters'],
      maxlength: [30, 'Room name cannot exceed 30 characters'],
    },
    // The user who created this room
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['public', 'private'],
      required: [true, 'Room status is required'],
      default: 'public',
    },
    // bcrypt hash of room password — only present when status === 'private'
    passwordHash: {
      type: String,
      default: null,
    },
    // Maximum number of concurrent members (2–50)
    maxMembers: {
      type: Number,
      required: [true, 'Max members is required'],
      min: [2, 'Room must allow at least 2 members'],
      max: [50, 'Room cannot exceed 50 members'],
      default: 10,
    },
    // Array of User ObjectIds currently in the room (persistent membership)
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // Array of User ObjectIds banned/restricted from the room by the creator
    bannedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
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

// Index for room name lookups (uniqueness enforced by unique option)
roomSchema.index({ name: 1 });
// Index for listing rooms sorted by creation date
roomSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Room', roomSchema);
