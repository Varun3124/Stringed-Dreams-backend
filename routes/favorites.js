const express = require('express');
const router = express.Router();
const {
  getFavorites,
  addToFavorites,
  removeFromFavorites,
  clearFavorites,
  toggleFavorite
} = require('../controllers/favoritesController');
const { protect } = require('../middleware/auth');

router.route('/')
  .get(protect, getFavorites)
  .post(protect, addToFavorites)
  .delete(protect, clearFavorites);

router.route('/toggle')
  .post(protect, toggleFavorite);

router.route('/:itemId')
  .delete(protect, removeFromFavorites);

module.exports = router;
