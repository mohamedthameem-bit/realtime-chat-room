const Post = require('../models/Post');
const Reel = require('../models/Reel');

const getExplore = async (req, res) => {
  try {
    // Fetch recent 30 public posts
    const posts = await Post.find({ visibility: 'public', isArchived: false })
      .sort({ createdAt: -1 })
      .limit(30)
      .populate('author', 'username profilePicture name')
      .lean();

    // Fetch recent 30 public reels
    const reels = await Reel.find({ visibility: 'public' })
      .sort({ createdAt: -1 })
      .limit(30)
      .populate('author', 'username profilePicture name')
      .lean();

    // Mix them into a single array
    const mixed = [...posts, ...reels];

    // Sort by createdAt descending
    mixed.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Optionally slice to 30 to only return the recent 30 total items
    res.json(mixed.slice(0, 30));
  } catch (error) {
    console.error('Error fetching explore feed:', error);
    res.status(500).json({ error: 'Server error fetching explore feed.' });
  }
};

module.exports = {
  getExplore
};
