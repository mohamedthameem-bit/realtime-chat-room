const Reel = require('../models/Reel');
const Hashtag = require('../models/Hashtag');
const fs = require('fs');
const path = require('path');

// Helper function to extract hashtags
const extractHashtags = (text) => {
  if (!text) return [];
  const regex = /#[\w-]+/g;
  const tags = text.match(regex);
  return tags ? tags.map(tag => tag.slice(1).toLowerCase()) : [];
};

// Create a new Reel
const createReel = async (req, res) => {
  try {
    const { caption, audioName, visibility } = req.body;
    const authorId = req.user._id;

    if (!req.file) {
      return res.status(400).json({ error: 'Video file is required for a reel.' });
    }

    const videoUrl = `/uploads/reels/${req.file.filename}`;
    const tags = extractHashtags(caption);

    // Optionally update Hashtag documents (assuming reelCount or similar exists, else we can skip or use postCount)
    // We'll update the hashtag collection for indexing
    for (const tag of tags) {
      await Hashtag.findOneAndUpdate(
        { name: tag },
        { $inc: { postCount: 1 } }, // Reusing postCount or assume it tracks general occurrences
        { upsert: true, new: true }
      );
    }

    const newReel = new Reel({
      author: authorId,
      videoUrl,
      caption: caption || '',
      audioName: audioName || '',
      visibility: visibility || 'public',
      hashtags: tags
    });

    await newReel.save();
    res.status(201).json(newReel);
  } catch (error) {
    console.error('Error creating reel:', error);
    res.status(500).json({ error: 'Server error creating reel.' });
  }
};

// Get feed reels (paginated or recent 20 public)
const getFeedReels = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const reels = await Reel.find({ visibility: 'public' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('author', 'username profilePicture name');

    res.json(reels);
  } catch (error) {
    console.error('Error fetching reels:', error);
    res.status(500).json({ error: 'Server error fetching reels.' });
  }
};

// Like/Unlike a Reel
const likeReel = async (req, res) => {
  try {
    const reelId = req.params.id;
    const userId = req.user._id;

    const reel = await Reel.findById(reelId);
    if (!reel) {
      return res.status(404).json({ error: 'Reel not found.' });
    }

    const hasLiked = reel.likes.includes(userId);
    if (hasLiked) {
      reel.likes = reel.likes.filter(id => id.toString() !== userId.toString());
    } else {
      reel.likes.push(userId);
    }

    await reel.save();
    res.json({ success: true, likesCount: reel.likes.length, hasLiked: !hasLiked });
  } catch (error) {
    console.error('Error toggling reel like:', error);
    res.status(500).json({ error: 'Server error toggling like.' });
  }
};

// Delete a Reel and its file
const deleteReel = async (req, res) => {
  try {
    const reelId = req.params.id;
    const userId = req.user._id;

    const reel = await Reel.findById(reelId);
    if (!reel) {
      return res.status(404).json({ error: 'Reel not found.' });
    }

    if (reel.author.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'Unauthorized to delete this reel.' });
    }

    if (reel.videoUrl) {
      const fileName = reel.videoUrl.split('/').pop();
      const filePath = path.join(__dirname, '../../public/uploads/reels', fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await Reel.findByIdAndDelete(reelId);
    res.json({ success: true, message: 'Reel deleted successfully.' });
  } catch (error) {
    console.error('Error deleting reel:', error);
    res.status(500).json({ error: 'Server error deleting reel.' });
  }
};

module.exports = {
  createReel,
  getFeedReels,
  likeReel,
  deleteReel
};
