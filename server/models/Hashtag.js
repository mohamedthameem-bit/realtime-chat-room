const mongoose = require('mongoose');

const hashtagSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, lowercase: true, trim: true },
  postCount: { type: Number, default: 0 },
  reelCount: { type: Number, default: 0 }
}, { timestamps: false, versionKey: false });

hashtagSchema.index({ name: 1 });
hashtagSchema.index({ postCount: -1, reelCount: -1 });

module.exports = mongoose.model('Hashtag', hashtagSchema);
