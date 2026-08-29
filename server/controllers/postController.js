const Post = require('../models/Post');
const User = require('../models/User');
const Hashtag = require('../models/Hashtag');
const Notification = require('../models/Notification');
const SavedCollection = require('../models/SavedCollection');
const fs = require('fs');
const path = require('path');

// Helper function to extract hashtags
const extractHashtags = (text) => {
  if (!text) return [];
  const regex = /#[\w-]+/g;
  const tags = text.match(regex);
  return tags ? tags.map(tag => tag.slice(1).toLowerCase()) : [];
};

// 1. createPost
const createPost = async (req, res) => {
  try {
    const { caption, visibility, altText } = req.body;
    const authorId = req.user._id;

    const mediaUrls = [];
    const mediaTypes = [];

    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        mediaUrls.push(`/uploads/posts/${file.filename}`);
        if (file.mimetype.startsWith('image/')) {
          mediaTypes.push('image');
        } else if (file.mimetype.startsWith('video/')) {
          mediaTypes.push('video');
        } else {
          mediaTypes.push('unknown');
        }
      });
    }

    const tags = extractHashtags(caption);

    // Update Hashtag documents
    for (const tag of tags) {
      await Hashtag.findOneAndUpdate(
        { name: tag },
        { $inc: { postCount: 1 } },
        { upsert: true, new: true }
      );
    }

    // Mentions logic (stub for now)
    const mentions = []; // To be implemented

    const post = new Post({
      author: authorId,
      caption,
      mediaUrls,
      mediaTypes,
      visibility: visibility || 'public',
      altText,
      hashtags: tags,
      mentions
    });

    await post.save();

    res.status(201).json({ message: 'Post created successfully', post });
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ error: 'Server error creating post' });
  }
};

// 2. getFeed
const getFeed = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const currentUser = await User.findById(userId);
    if (!currentUser) return res.status(404).json({ error: 'User not found' });

    const followingIds = currentUser.following || [];
    const authorIds = [...followingIds, userId];

    const posts = await Post.find({
      author: { $in: authorIds },
      isArchived: false,
      $or: [
        { visibility: 'public' },
        { visibility: 'followers' }
      ]
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('author', 'username profilePicUrl name');

    res.status(200).json({ posts, page });
  } catch (error) {
    console.error('Error getting feed:', error);
    res.status(500).json({ error: 'Server error getting feed' });
  }
};

// 3. getPost
const getPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('author', 'username profilePicUrl name');
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.status(200).json(post);
  } catch (error) {
    console.error('Error getting post:', error);
    res.status(500).json({ error: 'Server error getting post' });
  }
};

// 4. editPost
const editPost = async (req, res) => {
  try {
    const { caption, visibility, altText } = req.body;
    const postId = req.params.id;
    const userId = req.user._id;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.author.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'Not authorized to edit this post' });
    }

    const oldTags = post.hashtags || [];
    const newTags = extractHashtags(caption);

    // Decrement old tags
    for (const tag of oldTags) {
      if (!newTags.includes(tag)) {
        await Hashtag.findOneAndUpdate(
          { name: tag },
          { $inc: { postCount: -1 } }
        );
      }
    }

    // Increment new tags
    for (const tag of newTags) {
      if (!oldTags.includes(tag)) {
        await Hashtag.findOneAndUpdate(
          { name: tag },
          { $inc: { postCount: 1 } },
          { upsert: true }
        );
      }
    }

    if (caption !== undefined) post.caption = caption;
    if (visibility !== undefined) post.visibility = visibility;
    if (altText !== undefined) post.altText = altText;
    post.hashtags = newTags;

    await post.save();

    res.status(200).json({ message: 'Post updated successfully', post });
  } catch (error) {
    console.error('Error editing post:', error);
    res.status(500).json({ error: 'Server error editing post' });
  }
};

// 5. deletePost
const deletePost = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user._id;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.author.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'Not authorized to delete this post' });
    }

    // Delete files from disk
    if (post.mediaUrls && post.mediaUrls.length > 0) {
      post.mediaUrls.forEach(fileUrl => {
        const filePath = path.join(__dirname, '../../public', fileUrl);
        fs.unlink(filePath, (err) => {
          if (err) console.error(`Failed to delete file ${filePath}:`, err);
        });
      });
    }

    // Decrement hashtag counts
    if (post.hashtags && post.hashtags.length > 0) {
      for (const tag of post.hashtags) {
        await Hashtag.findOneAndUpdate(
          { name: tag },
          { $inc: { postCount: -1 } }
        );
      }
    }

    await Post.findByIdAndDelete(postId);

    res.status(200).json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ error: 'Server error deleting post' });
  }
};

// 6. toggleLike
const toggleLike = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user._id;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const likeIndex = post.likes.indexOf(userId);
    let isLiked = false;

    if (likeIndex === -1) {
      // Add like
      post.likes.push(userId);
      isLiked = true;

      // Create notification
      if (post.author.toString() !== userId.toString()) {
        await Notification.create({
          recipient: post.author,
          sender: userId,
          type: 'like_post',
          post: postId
        });
      }
    } else {
      // Remove like
      post.likes.splice(likeIndex, 1);
    }

    await post.save();

    res.status(200).json({ message: isLiked ? 'Post liked' : 'Post unliked', isLiked, likesCount: post.likes.length });
  } catch (error) {
    console.error('Error toggling like:', error);
    res.status(500).json({ error: 'Server error toggling like' });
  }
};

// 7. toggleSave
const toggleSave = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user._id;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    let isSaved = false;
    const saveIndex = post.saves.indexOf(userId);

    if (saveIndex === -1) {
      post.saves.push(userId);
      isSaved = true;
    } else {
      post.saves.splice(saveIndex, 1);
    }
    
    await post.save();

    // Find or create default "All Posts" collection for user
    let defaultCollection = await SavedCollection.findOne({ owner: userId, name: 'All Posts' });
    if (!defaultCollection) {
      defaultCollection = new SavedCollection({
        owner: userId,
        name: 'All Posts',
        items: []
      });
    }

    if (isSaved) {
      const exists = defaultCollection.items.find(i => i.targetId.toString() === postId.toString());
      if (!exists) {
        defaultCollection.items.push({ targetType: 'post', targetId: postId });
      }
    } else {
      defaultCollection.items = defaultCollection.items.filter(i => i.targetId.toString() !== postId.toString());
    }
    
    await defaultCollection.save();

    res.status(200).json({ message: isSaved ? 'Post saved' : 'Post unsaved', isSaved });
  } catch (error) {
    console.error('Error toggling save:', error);
    res.status(500).json({ error: 'Server error toggling save' });
  }
};

// 8. incrementShare
const incrementShare = async (req, res) => {
  try {
    const postId = req.params.id;
    const post = await Post.findByIdAndUpdate(
      postId,
      { $inc: { shareCount: 1 } },
      { new: true }
    );

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.status(200).json({ message: 'Share count incremented', shareCount: post.shareCount });
  } catch (error) {
    console.error('Error incrementing share:', error);
    res.status(500).json({ error: 'Server error incrementing share' });
  }
};

// 9. getUserPosts
const getUserPosts = async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 12;
    const skip = (page - 1) * limit;
    
    const isSelf = req.user._id.toString() === userId.toString();

    const query = { author: userId };
    if (!isSelf) {
      query.isArchived = false;
      query.visibility = { $in: ['public', 'followers'] };
    }

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({ posts, page });
  } catch (error) {
    console.error('Error getting user posts:', error);
    res.status(500).json({ error: 'Server error getting user posts' });
  }
};

// 10. getArchivedPosts
const getArchivedPosts = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 12;
    const skip = (page - 1) * limit;

    const posts = await Post.find({
      author: userId,
      isArchived: true
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({ posts, page });
  } catch (error) {
    console.error('Error getting archived posts:', error);
    res.status(500).json({ error: 'Server error getting archived posts' });
  }
};

// 11. toggleArchive
const toggleArchive = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user._id;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.author.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'Not authorized to archive this post' });
    }

    post.isArchived = !post.isArchived;
    await post.save();

    res.status(200).json({ message: post.isArchived ? 'Post archived' : 'Post unarchived', isArchived: post.isArchived });
  } catch (error) {
    console.error('Error toggling archive:', error);
    res.status(500).json({ error: 'Server error toggling archive' });
  }
};

module.exports = {
  createPost,
  getFeed,
  getPost,
  editPost,
  deletePost,
  toggleLike,
  toggleSave,
  incrementShare,
  getUserPosts,
  getArchivedPosts,
  toggleArchive
};
