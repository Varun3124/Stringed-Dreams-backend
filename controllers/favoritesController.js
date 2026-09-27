const Favorite = require('../models/Favorite');
const Product = require('../models/Product');

// Populated products never include the inline image (it's served from its own URL)
const PRODUCT_POPULATE = { path: 'items.product', select: '-image -reviews' };

// @desc    Get user favorites
// @route   GET /api/favorites
// @access  Private
const getFavorites = async (req, res) => {
  try {
    const favorites = await Favorite.findOne({ user: req.user._id }).populate(PRODUCT_POPULATE);

    if (favorites) {
      res.json(favorites);
    } else {
      res.json({ user: req.user._id, items: [] });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add item to favorites
// @route   POST /api/favorites
// @access  Private
const addToFavorites = async (req, res) => {
  try {
    const { productId } = req.body;

    const product = await Product.findById(productId).select('name price category');

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    let favorites = await Favorite.findOne({ user: req.user._id });

    if (!favorites) {
      favorites = new Favorite({
        user: req.user._id,
        items: []
      });
    }

    const existingItemIndex = favorites.items.findIndex(
      item => item.product.toString() === productId
    );

    if (existingItemIndex > -1) {
      return res.status(400).json({ message: 'Item already in favorites' });
    }

    favorites.items.push({
      product: productId,
      name: product.name,
      price: product.price,
      category: product.category
    });

    await favorites.save();
    await Product.findByIdAndUpdate(productId, { $inc: { likesCount: 1 } });
    await favorites.populate(PRODUCT_POPULATE);

    res.json(favorites);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Remove item from favorites
// @route   DELETE /api/favorites/:itemId
// @access  Private
const removeFromFavorites = async (req, res) => {
  try {
    const favorites = await Favorite.findOne({ user: req.user._id });

    if (!favorites) {
      return res.status(404).json({ message: 'Favorites not found' });
    }

    const removedItem = favorites.items.find(
      item => item._id.toString() === req.params.itemId
    );

    favorites.items = favorites.items.filter(
      item => item._id.toString() !== req.params.itemId
    );

    await favorites.save();
    if (removedItem) {
      await Product.findByIdAndUpdate(removedItem.product, { $inc: { likesCount: -1 } });
    }
    await favorites.populate(PRODUCT_POPULATE);

    res.json(favorites);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Clear favorites
// @route   DELETE /api/favorites
// @access  Private
const clearFavorites = async (req, res) => {
  try {
    const favorites = await Favorite.findOne({ user: req.user._id });

    if (favorites) {
      const productIds = favorites.items.map(item => item.product);
      favorites.items = [];
      await favorites.save();
      if (productIds.length > 0) {
        await Product.updateMany({ _id: { $in: productIds } }, { $inc: { likesCount: -1 } });
      }
    }

    res.json({ message: 'Favorites cleared' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Toggle favorite
// @route   POST /api/favorites/toggle
// @access  Private
const toggleFavorite = async (req, res) => {
  try {
    const { productId } = req.body;

    const product = await Product.findById(productId).select('name price category');

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    let favorites = await Favorite.findOne({ user: req.user._id });

    if (!favorites) {
      favorites = new Favorite({
        user: req.user._id,
        items: []
      });
    }

    const existingItemIndex = favorites.items.findIndex(
      item => item.product.toString() === productId
    );

    if (existingItemIndex > -1) {
      // Remove from favorites
      favorites.items.splice(existingItemIndex, 1);
      await favorites.save();
      await favorites.populate(PRODUCT_POPULATE);
      // Decrement likesCount
      await Product.findByIdAndUpdate(productId, { $inc: { likesCount: -1 } });
      res.json({ message: 'Removed from favorites', favorites, isFavorite: false });
    } else {
      // Add to favorites
      favorites.items.push({
        product: productId,
        name: product.name,
        price: product.price,
          category: product.category
      });
      await favorites.save();
      await favorites.populate(PRODUCT_POPULATE);
      // Increment likesCount
      await Product.findByIdAndUpdate(productId, { $inc: { likesCount: 1 } });
      res.json({ message: 'Added to favorites', favorites, isFavorite: true });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getFavorites,
  addToFavorites,
  removeFromFavorites,
  clearFavorites,
  toggleFavorite
};
