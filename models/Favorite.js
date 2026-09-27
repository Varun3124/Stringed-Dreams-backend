const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
    unique: true
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    // Legacy snapshot of the product image; no longer stored (images come from the product)
    image: {
      type: String
    },
    category: {
      type: String
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true,
  toJSON: {
    transform(doc, ret) {
      (ret.items || []).forEach((item) => { delete item.image; });
      return ret;
    }
  }
});

module.exports = mongoose.model('Favorite', favoriteSchema);
