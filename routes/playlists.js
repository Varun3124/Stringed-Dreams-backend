const express = require('express');
const router = express.Router();
const {
  getPlaylists,
  getPlaylist,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  addItem,
  removeItem
} = require('../controllers/playlistController');
const { protect } = require('../middleware/auth');

router.route('/')
  .get(protect, getPlaylists)
  .post(protect, createPlaylist);

router.route('/:id')
  .get(protect, getPlaylist)
  .put(protect, updatePlaylist)
  .delete(protect, deletePlaylist);

router.route('/:id/items')
  .post(protect, addItem);

router.route('/:id/items/:productId')
  .delete(protect, removeItem);

module.exports = router;
