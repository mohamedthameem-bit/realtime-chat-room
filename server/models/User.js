/**
 * User.js — Mongoose model for authenticated users.
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
      // Alphanumeric + underscores + hyphens only
      match: [/^[a-zA-Z0-9_-]+$/, 'Username may only contain letters, numbers, underscores, and hyphens'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
    },
    // Optional display name (shown in profile, not used for auth)
    name: {
      type: String,
      trim: true,
      maxlength: [40, 'Name cannot exceed 40 characters'],
      default: '',
    },
    // Short bio shown on profile
    bio: {
      type: String,
      trim: true,
      maxlength: [150, 'Bio cannot exceed 150 characters'],
      default: '',
    },
    // Path to uploaded avatar file, or empty string (client shows a letter-avatar fallback)
    profilePic: {
      type: String,
      default: '',
    },
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

// Index for fast username lookups (uniqueness is already enforced by the unique option)
userSchema.index({ username: 1 });

/**
 * Return a safe public representation of the user (no passwordHash).
 */
userSchema.methods.toPublic = function () {
  return {
    _id:        this._id,
    username:   this.username,
    name:       this.name,
    bio:        this.bio,
    profilePic: this.profilePic,
    createdAt:  this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
