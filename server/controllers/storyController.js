const Story = require('../models/Story');
const User = require('../models/User');
const fs = require('fs');
const path = require('path');

const createStory = async (req, res) => {
  try {
    const { audience } = req.body;
    if (!req.file) {
      return res.status(400).json({ error: 'Media file is required' });
    }

    const story = new Story({
      author: req.user._id,
      mediaUrl: `/uploads/${req.file.filename}`,
      mediaType: req.file.mimetype.startsWith('video') ? 'video' : 'image',
      audience: audience || 'followers',
    });

    await story.save();
    res.status(201).json(story);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getFeedStories = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const followingAndSelf = [...(user.following || []), userId];

    const stories = await Story.find({
      author: { $in: followingAndSelf },
      createdAt: { $gt: oneDayAgo }
    }).populate('author', 'username profilePicture').sort({ createdAt: 1 });

    // Group by author
    const groupedStories = stories.reduce((acc, story) => {
      const authorId = story.author._id.toString();
      if (!acc[authorId]) {
        acc[authorId] = {
          author: story.author,
          stories: []
        };
      }
      acc[authorId].stories.push(story);
      return acc;
    }, {});

    res.status(200).json(Object.values(groupedStories));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const reactToStory = async (req, res) => {
  try {
    const { id } = req.params;
    const { reaction } = req.body;
    
    const story = await Story.findById(id);
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    story.viewers.push({
      user: req.user._id,
      reaction: reaction,
      viewedAt: new Date()
    });

    await story.save();
    res.status(200).json(story);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteStory = async (req, res) => {
  try {
    const { id } = req.params;
    const story = await Story.findById(id);
    
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    if (story.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized to delete this story' });
    }

    // Attempt to delete file
    if (story.mediaUrl) {
      const filename = path.basename(story.mediaUrl);
      const filePath = path.join(__dirname, '..', 'public', 'uploads', filename);
      fs.unlink(filePath, (err) => {
        if (err) console.error('Failed to delete story media:', err);
      });
    }

    await Story.findByIdAndDelete(id);
    res.status(200).json({ message: 'Story deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createStory,
  getFeedStories,
  reactToStory,
  deleteStory
};
