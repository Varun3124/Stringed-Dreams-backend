const Playlist = require('../models/Playlist');

// Populated products never include the inline image (it's served from its own URL)
const PRODUCT_POPULATE = { path: 'items.product', select: '-image -reviews' };

// @desc    Get user playlists
// @route   GET /api/playlists
// @access  Private
const getPlaylists = async (req, res) => {
  try {
    const playlists = await Playlist.find({ user: req.user._id })
      .populate(PRODUCT_POPULATE)
      .sort({ updatedAt: -1 });
    res.json(playlists);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single playlist
// @route   GET /api/playlists/:id
// @access  Private
const getPlaylist = async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id)
      .populate(PRODUCT_POPULATE)
      .populate('user', 'name');

    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }

    // Owners, admins (e.g. following a chat reference), or anyone for public playlists
    const isOwner = playlist.user?._id?.toString() === req.user._id.toString();
    if (!isOwner && !playlist.isPublic && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    res.json(playlist);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create playlist
// @route   POST /api/playlists
// @access  Private
const createPlaylist = async (req, res) => {
  try {
    const { name, description } = req.body;
    const playlist = await Playlist.create({
      user: req.user._id,
      name,
      description: description || ''
    });
    
    const populated = await playlist.populate(PRODUCT_POPULATE);
    res.status(201).json(populated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update playlist
// @route   PUT /api/playlists/:id
// @access  Private
const updatePlaylist = async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }
    if (playlist.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { name, description, isPublic } = req.body;
    if (name) playlist.name = name;
    if (description !== undefined) playlist.description = description;
    if (isPublic !== undefined) playlist.isPublic = isPublic;

    await playlist.save();
    const populated = await playlist.populate(PRODUCT_POPULATE);
    res.json(populated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete playlist
// @route   DELETE /api/playlists/:id
// @access  Private
const deletePlaylist = async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }
    if (playlist.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await Playlist.findByIdAndDelete(req.params.id);
    res.json({ message: 'Playlist deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add item to playlist
// @route   POST /api/playlists/:id/items
// @access  Private
const addItem = async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }
    if (playlist.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { productId } = req.body;
    const exists = playlist.items.some(item => item.product.toString() === productId);
    if (exists) {
      return res.status(400).json({ message: 'Product already in playlist' });
    }

    playlist.items.push({ product: productId });
    await playlist.save();
    const populated = await playlist.populate(PRODUCT_POPULATE);
    res.json(populated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Remove item from playlist
// @route   DELETE /api/playlists/:id/items/:productId
// @access  Private
const removeItem = async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }
    if (playlist.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    playlist.items = playlist.items.filter(
      item => item.product.toString() !== req.params.productId
    );
    await playlist.save();
    const populated = await playlist.populate(PRODUCT_POPULATE);
    res.json(populated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  getPlaylists,
  getPlaylist,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  addItem,
  removeItem
};
