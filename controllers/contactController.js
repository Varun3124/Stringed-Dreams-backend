const Contact = require('../models/Contact');

// Population config for messages
const messagePopulate = [
  { path: 'messages.sender', select: 'name email' },
  { path: 'messages.product', select: 'name price imageVersion' },
  { path: 'messages.playlist', select: 'name items' },
  { path: 'user', select: 'name email phone' }
];

// @desc    Get or create the user's single chat
// @route   GET /api/contact/chat
// @access  Private
const getOrCreateChat = async (req, res) => {
  try {
    let conversation = await Contact.findOne({ user: req.user._id }).populate(messagePopulate);

    if (!conversation) {
      conversation = await Contact.create({
        user: req.user._id,
        subject: 'Chat',
        messages: [],
        lastMessageAt: new Date(),
        status: 'new'
      });
      conversation = await Contact.findById(conversation._id).populate(messagePopulate);
    }

    res.json(conversation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create new conversation
// @route   POST /api/contact
// @access  Private
const createConversation = async (req, res) => {
  try {
    const { subject, text, product, playlist } = req.body;

    if (!subject || !text) {
      return res.status(400).json({ message: 'Subject and message are required' });
    }

    const firstMessage = {
      sender: req.user._id,
      senderRole: 'user',
      text,
      product: product || undefined,
      playlist: playlist || undefined
    };

    const conversation = await Contact.create({
      user: req.user._id,
      subject,
      messages: [firstMessage],
      lastMessageAt: new Date(),
      status: 'new'
    });

    const populated = await Contact.findById(conversation._id).populate(messagePopulate);
    res.status(201).json(populated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get current user's conversations
// @route   GET /api/contact/my
// @access  Private
const getUserConversations = async (req, res) => {
  try {
    const conversations = await Contact.find({ user: req.user._id })
      .populate('user', 'name email')
      .sort({ lastMessageAt: -1 });
    
    // Return summary with last message
    const summary = conversations.map(c => ({
      _id: c._id,
      subject: c.subject,
      status: c.status,
      lastMessageAt: c.lastMessageAt,
      createdAt: c.createdAt,
      lastMessage: c.messages.length > 0 ? {
        text: c.messages[c.messages.length - 1].text,
        senderRole: c.messages[c.messages.length - 1].senderRole,
        createdAt: c.messages[c.messages.length - 1].createdAt
      } : null,
      messageCount: c.messages.length,
      unreadByUser: c.status === 'replied'
    }));
    
    res.json(summary);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single conversation with all messages
// @route   GET /api/contact/:id
// @access  Private (user owns it or admin)
const getConversation = async (req, res) => {
  try {
    const conversation = await Contact.findById(req.params.id).populate(messagePopulate);
    
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    
    // Only owner or admin can view
    if (conversation.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    res.json(conversation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add message to conversation
// @route   POST /api/contact/:id/messages
// @access  Private (user owns it or admin)
const addMessage = async (req, res) => {
  try {
    const { text, product, playlist } = req.body;
    
    if (!text) {
      return res.status(400).json({ message: 'Message text is required' });
    }
    
    const conversation = await Contact.findById(req.params.id);
    
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    
    // Only owner or admin can add messages
    if (conversation.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    const senderRole = req.user.role === 'admin' ? 'admin' : 'user';
    
    conversation.messages.push({
      sender: req.user._id,
      senderRole,
      text,
      product: product || undefined,
      playlist: playlist || undefined
    });
    
    conversation.lastMessageAt = new Date();
    
    // Update status based on who sent
    if (senderRole === 'admin') {
      conversation.status = 'replied';
    } else if (conversation.status === 'replied' || conversation.status === 'read') {
      conversation.status = 'new';
    }
    
    await conversation.save();
    
    const populated = await Contact.findById(conversation._id).populate(messagePopulate);
    res.status(201).json(populated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get all conversations (admin)
// @route   GET /api/contact
// @access  Private/Admin
const getInquiries = async (req, res) => {
  try {
    const conversations = await Contact.find({})
      .populate('user', 'name email phone')
      .sort({ lastMessageAt: -1 });
    
    const summary = conversations.map(c => ({
      _id: c._id,
      user: c.user,
      subject: c.subject,
      status: c.status,
      lastMessageAt: c.lastMessageAt,
      createdAt: c.createdAt,
      lastMessage: c.messages.length > 0 ? {
        text: c.messages[c.messages.length - 1].text,
        senderRole: c.messages[c.messages.length - 1].senderRole,
        createdAt: c.messages[c.messages.length - 1].createdAt
      } : null,
      messageCount: c.messages.length
    }));
    
    res.json(summary);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update conversation status
// @route   PUT /api/contact/:id
// @access  Private/Admin
const updateInquiry = async (req, res) => {
  try {
    const conversation = await Contact.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    conversation.status = req.body.status || conversation.status;
    await conversation.save();
    
    res.json(conversation);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete conversation
// @route   DELETE /api/contact/:id
// @access  Private/Admin
const deleteInquiry = async (req, res) => {
  try {
    const conversation = await Contact.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    await Contact.findByIdAndDelete(req.params.id);
    res.json({ message: 'Conversation deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getOrCreateChat,
  createConversation,
  getUserConversations,
  getConversation,
  addMessage,
  getInquiries,
  updateInquiry,
  deleteInquiry
};
