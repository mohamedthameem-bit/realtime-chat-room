const mongoose = require('mongoose');

const reelSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  videoUrl: { type: String, required: true },
  thumbnailUrl: { type: String, default: '' },
  caption: { type: String, maxlength: 2200, default: '' },
  audioName: { type: String, default: '' },
  hashtags: [String],
  mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  saves: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  commentCount: { type: Number, default: 0 },
  shareCount: { type: Number, default: 0 },
  views: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  duration: Number,  // seconds, max 90
  visibility: { type: String, enum: ['public', 'followers'], default: 'public' },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: false, versionKey: false });

reelSchema.index({ author: 1, createdAt: -1 });
reelSchema.index({ hashtags: 1 });
reelSchema.index({ views: 1 });
reelSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Reel', reelSchema);
