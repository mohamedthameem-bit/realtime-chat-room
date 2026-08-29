const SavedCollection = require('../models/SavedCollection');
const Post = require('../models/Post');
const Reel = require('../models/Reel');

exports.getCollections = async (req, res) => {
  try {
    const collections = await SavedCollection.find({ owner: req.user._id }).sort({ createdAt: -1 });
    return res.status(200).json(collections);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error fetching saved collections.' });
  }
};

exports.getCollectionById = async (req, res) => {
  try {
    const collection = await SavedCollection.findById(req.params.id);
    if (!collection) {
      return res.status(404).json({ error: 'Collection not found.' });
    }
    
    // Ensure the user owns the collection (optional but standard for private collections)
    if (collection.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to view this collection.' });
    }

    // Populate the items. Mongoose doesn't easily populate mixed models in a subdocument array with dynamic refs.
    // We'll map through them and populate manually.
    const populatedItems = await Promise.all(
      collection.items.map(async (item) => {
        let target = null;
        if (item.targetType === 'post') {
          target = await Post.findById(item.targetId).populate('author', 'username profilePic');
        } else if (item.targetType === 'reel') {
          target = await Reel.findById(item.targetId).populate('author', 'username profilePic');
        }
        return {
          ...item.toObject(),
          target
        };
      })
    );

    const result = {
      ...collection.toObject(),
      items: populatedItems.filter(i => i.target !== null) // filter out deleted posts/reels
    };

    return res.status(200).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error fetching collection.' });
  }
};

exports.createCollection = async (req, res) => {
  try {
    const { name, coverUrl, items } = req.body;
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Collection name is required.' });
    }

    const newCollection = new SavedCollection({
      owner: req.user._id,
      name: name.trim(),
      coverUrl: coverUrl || '',
      items: items || []
    });

    await newCollection.save();
    return res.status(201).json(newCollection);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error creating collection.' });
  }
};
