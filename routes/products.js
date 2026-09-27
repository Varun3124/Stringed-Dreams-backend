const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProductById,
  getProductImage,
  createProductReview
} = require('../controllers/productController');
const Category = require('../models/Category');
const { protect } = require('../middleware/auth');

// Let browsers keep a copy but revalidate it (ETag → 304 when nothing changed)
const revalidate = (req, res, next) => {
  res.set('Cache-Control', 'no-cache');
  next();
};

// Get all categories (public)
router.get('/categories', revalidate, async (req, res) => {
  try {
    const categories = await Category.find({}).sort({ name: 1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.route('/').get(revalidate, getProducts);

router.route('/:id/image').get(getProductImage);

router.route('/:id').get(revalidate, getProductById);

router.route('/:id/reviews').post(protect, createProductReview);

module.exports = router;
