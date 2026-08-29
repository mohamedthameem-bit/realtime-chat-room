/**
 * dmController.js — Controllers for Direct Messaging (Phase 6).
 */

const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');

/**
 * GET /api/dm/conversations
 * List all DM conversations for the logged-in user.
 */
async function getConversations(req, res, next) {
  try {
    const userId = req.user._id;

    const conversations = await Conversation.find({ participants: userId })
      .populate('participants', 'username profilePic status')
      .lean();

    // Fetch the latest message and unread count for each conversation
    const convsWithData = await Promise.all(
      conversations.map(async (conv) => {
        const latestMessage = await Message.findOne({ conversationId: conv._id })
          .sort({ createdAt: -1 })
          .lean();

        const unreadCount = await Message.countDocuments({
          conversationId: conv._id,
          readBy: { $ne: userId },
          userId: { $ne: userId }, // Don't count our own messages as unread
        });

        // Identify the "other" participant
        const otherUser = conv.participants.find((p) => p._id.toString() !== userId.toString());

        return {
          _id: conv._id,
          otherUser,
          latestMessage,
          unreadCount,
          updatedAt: latestMessage ? latestMessage.createdAt : conv.createdAt,
        };
      })
    );

    // Sort by most recent activity
    convsWithData.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    res.json({ success: true, conversations: convsWithData });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/dm/conversations
 * Start a new DM conversation or get an existing one.
 * Body: { targetUserId }
 */
async function startConversation(req, res, next) {
  try {
    const userId = req.user._id;
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'Target user ID is required.' });
    }
    if (userId.toString() === targetUserId.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot start a conversation with yourself.' });
    }

    const targetUser = await User.findById(targetUserId).lean();
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Check if conversation already exists
    let conv = await Conversation.findOne({
      participants: { $all: [userId, targetUserId] },
    }).populate('participants', 'username profilePic status');

    if (!conv) {
      conv = await Conversation.create({ participants: [userId, targetUserId] });
      conv = await Conversation.findById(conv._id).populate('participants', 'username profilePic status');
    }

    res.json({ success: true, conversation: conv });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/dm/conversations/:id/messages
 * Fetch the last 50 messages for a conversation, and mark them as read.
 */
async function getConversationMessages(req, res, next) {
  try {
    const userId = req.user._id;
    const conversationId = req.params.id;

    const conv = await Conversation.findById(conversationId).lean();
    if (!conv || !conv.participants.some((p) => p.toString() === userId.toString())) {
      return res.status(404).json({ success: false, message: 'Conversation not found.' });
    }

    const messages = await Message.find({ conversationId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Mark these messages as read by the current user
    const unreadMsgIds = messages
      .filter((m) => m.userId && m.userId.toString() !== userId.toString() && !m.readBy.some(id => id.toString() === userId.toString()))
      .map((m) => m._id);

    if (unreadMsgIds.length > 0) {
      await Message.updateMany(
        { _id: { $in: unreadMsgIds } },
        { $addToSet: { readBy: userId } }
      );
    }

    res.json({ success: true, messages: messages.reverse() });
  } catch (err) {
    next(err);
  }
}

async function createGroupChat(req, res, next) {
  try {
    const userId = req.user._id;
    const { participantIds, groupName, groupIcon } = req.body;

    if (!participantIds || !Array.isArray(participantIds) || participantIds.length < 1) {
      return res.status(400).json({ success: false, message: 'participantIds array is required.' });
    }
    if (!groupName) {
      return res.status(400).json({ success: false, message: 'groupName is required.' });
    }

    const allParticipants = [...new Set([...participantIds, userId.toString()])];
    
    let conv = await Conversation.create({
      participants: allParticipants,
      isGroup: true,
      groupName,
      groupIcon: groupIcon || '',
      admins: [userId]
    });
    conv = await Conversation.findById(conv._id).populate('participants', 'username profilePic status');
    
    res.json({ success: true, conversation: conv });
  } catch (err) {
    next(err);
  }
}

async function togglePinConversation(req, res, next) {
  try {
    const userId = req.user._id;
    const convId = req.params.id;
    
    const conv = await Conversation.findOne({ _id: convId, participants: userId });
    if (!conv) return res.status(404).json({ success: false, message: 'Conversation not found.' });

    const isPinned = conv.pinnedBy.some(id => id.toString() === userId.toString());
    if (isPinned) {
      conv.pinnedBy = conv.pinnedBy.filter(id => id.toString() !== userId.toString());
    } else {
      conv.pinnedBy.push(userId);
    }
    await conv.save();
    res.json({ success: true, isPinned: !isPinned });
  } catch (err) {
    next(err);
  }
}

async function toggleMuteConversation(req, res, next) {
  try {
    const userId = req.user._id;
    const convId = req.params.id;
    
    const conv = await Conversation.findOne({ _id: convId, participants: userId });
    if (!conv) return res.status(404).json({ success: false, message: 'Conversation not found.' });

    const isMuted = conv.mutedBy.some(id => id.toString() === userId.toString());
    if (isMuted) {
      conv.mutedBy = conv.mutedBy.filter(id => id.toString() !== userId.toString());
    } else {
      conv.mutedBy.push(userId);
    }
    await conv.save();
    res.json({ success: true, isMuted: !isMuted });
  } catch (err) {
    next(err);
  }
}

async function toggleDisappearingMessages(req, res, next) {
  try {
    const userId = req.user._id;
    const convId = req.params.id;

    const conv = await Conversation.findOne({ _id: convId, participants: userId });
    if (!conv) return res.status(404).json({ success: false, message: 'Conversation not found.' });

    if (conv.isGroup) {
      const isAdmin = conv.admins.some(adminId => adminId.toString() === userId.toString());
      if (!isAdmin) {
        return res.status(403).json({ success: false, message: 'Only admins can toggle disappearing messages in groups.' });
      }
    }

    conv.disappearingMessages = !conv.disappearingMessages;
    await conv.save();

    res.json({ success: true, disappearingMessages: conv.disappearingMessages });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getConversations,
  startConversation,
  getConversationMessages,
  createGroupChat,
  togglePinConversation,
  toggleMuteConversation,
  toggleDisappearingMessages
};
