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
    const categories = await Category.find({}).sort({ name: 1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.route('/').get(getProducts);

router.route('/:id').get(getProductById);

router.route('/:id/reviews').post(protect, createProductReview);

module.exports = router;
