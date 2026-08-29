const Highlight = require('../models/Highlight');
const Story = require('../models/Story');

const createHighlight = async (req, res) => {
  try {
    const { title, storyIds } = req.body;
    
    if (!title || !storyIds || storyIds.length === 0) {
      return res.status(400).json({ error: 'Title and at least one story are required' });
    }

    const firstStory = await Story.findById(storyIds[0]);
    const coverUrl = firstStory ? firstStory.mediaUrl : '';

    const highlight = new Highlight({
      author: req.user._id,
      title,
      stories: storyIds,
      coverUrl
    });

    await highlight.save();
    res.status(201).json(highlight);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getUserHighlights = async (req, res) => {
  try {
    const { userId } = req.params;
    const highlights = await Highlight.find({ author: userId })
      .populate('stories')
      .sort({ createdAt: -1 });
    
    res.status(200).json(highlights);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const addStory = async (req, res) => {
  try {
    const { id } = req.params;
    const { storyId } = req.body;

    const highlight = await Highlight.findById(id);
    
    if (!highlight) {
      return res.status(404).json({ error: 'Highlight not found' });
    }

    if (highlight.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!highlight.stories.includes(storyId)) {
      highlight.stories.push(storyId);
      await highlight.save();
    }

    res.status(200).json(highlight);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteHighlight = async (req, res) => {
  try {
    const { id } = req.params;
    
    const highlight = await Highlight.findById(id);
    if (!highlight) {
      return res.status(404).json({ error: 'Highlight not found' });
    }

    if (highlight.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await Highlight.findByIdAndDelete(id);
    res.status(200).json({ message: 'Highlight deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createHighlight,
  getUserHighlights,
  addStory,
  deleteHighlight
};
