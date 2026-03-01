const express = require('express');
const router = express.Router();
const {
  getOrCreateChat,
  createConversation,
  getUserConversations,
  getConversation,
  addMessage,
  getInquiries,
  updateInquiry,
  deleteInquiry
} = require('../controllers/contactController');
const { protect } = require('../middleware/auth');
const { admin } = require('../middleware/admin');

// User routes (auth required)
router.get('/chat', protect, getOrCreateChat);
router.post('/', protect, createConversation);
router.get('/my', protect, getUserConversations);
router.get('/:id', protect, getConversation);
router.post('/:id/messages', protect, addMessage);

// Admin routes
router.get('/', protect, admin, getInquiries);
router.route('/:id')
  .put(protect, admin, updateInquiry)
  .delete(protect, admin, deleteInquiry);

module.exports = router;
