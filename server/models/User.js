/**
 * User.js — Mongoose model for authenticated users (Phase 6: status + friends).
 */

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [20, 'Username cannot exceed 20 characters'],
      match: [/^[a-zA-Z0-9_-]+$/, 'Username may only contain letters, numbers, underscores, and hyphens'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
    },
    name: {
      type: String,
      trim: true,
      maxlength: [40, 'Name cannot exceed 40 characters'],
      default: '',
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [150, 'Bio cannot exceed 150 characters'],
      default: '',
    },
    profilePic: {
      type: String,
      default: '',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },

    // ── Phase 6: Online status ──────────────────────────────────────────────
    status: {
      type: String,
      enum: ['online', 'away', 'busy', 'invisible'],
      default: 'online',
    },

    // ── Phase 6: Friends list ───────────────────────────────────────────────
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

userSchema.index({ username: 1 });

userSchema.methods.toPublic = function () {
  return {
    _id:        this._id,
    username:   this.username,
    name:       this.name,
    bio:        this.bio,
    profilePic: this.profilePic,
    createdAt:  this.createdAt,
    status:     this.status,
  };
};

module.exports = mongoose.model('User', userSchema);
