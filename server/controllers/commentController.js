const Comment = require('../models/Comment');
const Post = require('../models/Post');
const Reel = require('../models/Reel');
const Notification = require('../models/Notification');

exports.createComment = async (req, res) => {
  try {
    const { targetType, targetId, text, parentId } = req.body;
    
    // Determine target model
    let TargetModel;
    if (targetType === 'post') TargetModel = Post;
    else if (targetType === 'reel') TargetModel = Reel;
    else return res.status(400).json({ error: 'Invalid target type' });

    const target = await TargetModel.findById(targetId);
    if (!target) return res.status(404).json({ error: 'Target not found' });

    const comment = new Comment({
      targetType,
      targetId,
      author: req.user._id,
      text,
      parentId: parentId || null
    });

    await comment.save();

    // Increment comment count
    target.commentCount = (target.commentCount || 0) + 1;
    await target.save();

    // Socket emission
    const io = req.app.get('io');
    if (io) {
      io.to(`room:${targetId}`).emit('comment-count', {
        targetId,
        commentCount: target.commentCount
      });
    }

    // Notifications
    if (parentId) {
      const parentComment = await Comment.findById(parentId);
      if (parentComment && parentComment.author.toString() !== req.user._id.toString()) {
        const notif = new Notification({
          recipient: parentComment.author,
          sender: req.user._id,
          type: 'reply_comment',
          targetModel: 'Comment',
          targetId: comment._id
        });
        await notif.save();
      }
    } else {
      if (target.author && target.author.toString() !== req.user._id.toString()) {
        const notif = new Notification({
          recipient: target.author,
          sender: req.user._id,
          type: 'comment',
          targetModel: targetType === 'post' ? 'Post' : 'Reel',
          targetId: target._id
        });
        await notif.save();
      }
    }

    await comment.populate('author', 'username profilePicture');
    res.status(201).json(comment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getComments = async (req, res) => {
  try {
    const { targetType, targetId, page = 1 } = req.query;
    const limit = 20;
    const skip = (page - 1) * limit;

    const comments = await Comment.find({
      targetType,
      targetId,
      parentId: null
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('author', 'username profilePicture');

    res.json(comments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.editComment = async (req, res) => {
  try {
    const { text } = req.body;
    const comment = await Comment.findById(req.params.id);

    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    if (comment.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    comment.text = text;
    // Assuming you might track edits: comment.isEdited = true;
    await comment.save();

    res.json(comment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    let TargetModel;
    if (comment.targetType === 'post') TargetModel = Post;
    else if (comment.targetType === 'reel') TargetModel = Reel;
    
    let target = null;
    if (TargetModel) {
      target = await TargetModel.findById(comment.targetId);
    }
    
    const isCommentAuthor = comment.author.toString() === req.user._id.toString();
    const isTargetAuthor = target && target.author.toString() === req.user._id.toString();

    if (!isCommentAuthor && !isTargetAuthor) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const repliesCount = await Comment.countDocuments({ parentId: comment._id });

    if (repliesCount > 0) {
      // Soft delete if replies exist
      comment.isDeleted = true;
      comment.text = '[Comment deleted]';
      await comment.save();
    } else {
      // Hard delete
      await comment.deleteOne();
      if (target) {
        target.commentCount = Math.max((target.commentCount || 1) - 1, 0);
        await target.save();

        const io = req.app.get('io');
        if (io) {
          io.to(`room:${target._id}`).emit('comment-count', {
            targetId: target._id,
            commentCount: target.commentCount
          });
        }
      }
    }

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.toggleLike = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    const userId = req.user._id;
    const isLiked = comment.likes.includes(userId);

    if (isLiked) {
      comment.likes.pull(userId);
    } else {
      comment.likes.push(userId);
    }

    await comment.save();

    if (!isLiked && comment.author.toString() !== userId.toString()) {
      const notif = new Notification({
        recipient: comment.author,
        sender: userId,
        type: 'like_comment',
        targetModel: 'Comment',
        targetId: comment._id
      });
      await notif.save();
    }

    res.json(comment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};
