const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  mediaUrls: [String],
  mediaTypes: [String],  // 'image' | 'video'
  caption: { type: String, maxlength: 2200, default: '' },
  hashtags: [String],
  mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  location: { name: { type: String, default: '' }, lat: Number, lng: Number },
  altText: [String],
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  saves: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  commentCount: { type: Number, default: 0 },
  shareCount: { type: Number, default: 0 },
  visibility: { type: String, enum: ['public', 'followers', 'close-friends'], default: 'public' },
  isArchived: { type: Boolean, default: false },
  commentsDisabled: { type: Boolean, default: false },
  edited: { type: Boolean, default: false },
  editedAt: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: false, versionKey: false });

postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ hashtags: 1 });
postSchema.index({ likes: 1 });
postSchema.index({ saves: 1 });
postSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Post', postSchema);
