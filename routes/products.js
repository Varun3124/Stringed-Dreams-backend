const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProductById,
  createProductReview
} = require('../controllers/productController');
const Category = require('../models/Category');
const { protect } = require('../middleware/auth');

// Get all categories (public)
router.get('/categories', async (req, res) => {
  try {
    console.log('[DEBUG] GET /categories called');
    const categories = await Category.find({}).sort({ name: 1 });
    console.log('[DEBUG] Categories found:', categories.length, categories.map(c => c.name));
    res.json(categories);
  } catch (error) {
    console.error('[DEBUG] GET /categories error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

router.route('/').get(getProducts);

router.route('/:id').get(getProductById);

router.route('/:id/reviews').post(protect, createProductReview);

module.exports = router;
