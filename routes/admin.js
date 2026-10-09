const express = require('express');
const router = express.Router();
const {
  getAllProducts,
  createProduct,
  updateProduct,
  bulkUpdateProducts,
  deleteProduct,
  restoreProduct,
  getAllCategories,
  createCategory,
  restoreCategory,
  updateCategory,
  reorderCategories,
  deleteCategory,
  updateProductCarousel,
  reorderProducts,
  bulkCreateProducts,
  duplicateProduct
} = require('../controllers/adminController');
const { protect } = require('../middleware/auth');
const { admin } = require('../middleware/admin');

// Product routes
router.route('/products')
  .get(protect, admin, getAllProducts)
  .post(protect, admin, createProduct);

router.route('/products/reorder')
  .put(protect, admin, reorderProducts);

router.route('/products/bulk')
  .post(protect, admin, bulkCreateProducts);

router.route('/products/bulk-update')
  .put(protect, admin, bulkUpdateProducts);

router.route('/products/restore')
  .post(protect, admin, restoreProduct);

router.route('/products/:id/duplicate')
  .post(protect, admin, duplicateProduct);

router.route('/products/:id')
  .put(protect, admin, updateProduct)
  .delete(protect, admin, deleteProduct);

router.route('/products/:id/carousel')
  .put(protect, admin, updateProductCarousel);

// Category routes
router.route('/categories')
  .get(protect, admin, getAllCategories)
  .post(protect, admin, createCategory);

router.route('/categories/reorder')
  .put(protect, admin, reorderCategories);

router.route('/categories/restore')
  .post(protect, admin, restoreCategory);

router.route('/categories/:id')
  .put(protect, admin, updateCategory)
  .delete(protect, admin, deleteCategory);

module.exports = router;
