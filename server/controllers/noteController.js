const Note = require('../models/Note');
const User = require('../models/User');

const createNote = async (req, res) => {
  try {
    const { text, audience } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    const note = new Note({
      author: req.user._id,
      text,
      audience: audience || 'followers',
    });

    await note.save();
    res.status(201).json(note);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getNotes = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    
    const followingAndSelf = [...(user.following || []), userId];

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const notes = await Note.find({
      author: { $in: followingAndSelf },
      createdAt: { $gt: oneDayAgo }
    })
    .populate('author', 'username profilePicture')
    .sort({ createdAt: -1 });

    res.status(200).json(notes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteNote = async (req, res) => {
  try {
    const { id } = req.params;
    
    const note = await Note.findById(id);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    if (note.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await Note.findByIdAndDelete(id);
    res.status(200).json({ message: 'Note deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createNote,
  getNotes,
  deleteNote
};
