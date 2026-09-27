const mongoose = require('mongoose');
const normalizeList = require('../utils/normalizeList');

// Images are stored as data URLs but never sent inline in JSON; clients load
// them from this cacheable endpoint instead (see productController.getProductImage).
const imageRoute = (id, version) => `/api/products/${id}/image?v=${version || 0}`;

const isExternalImage = (image) =>
  typeof image === 'string' && /^https?:\/\//i.test(image) && !image.includes('via.placeholder.com');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    default: '',
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  price: {
    type: Number,
    default: 0,
    min: 0
  },
  category: {
    type: String,
    default: ''
  },
  color: {
    type: [String],
    default: [],
    set: normalizeList
  },
  beadType: {
    type: [String],
    default: [],
    set: normalizeList
  },
  image: {
    type: String,
    default: 'https://via.placeholder.com/300'
  },
  // Bumped whenever the image changes, so image URLs can be cached forever
  imageVersion: {
    type: Number,
    default: 0
  },
  stock: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  numReviews: {
    type: Number,
    default: 0
  },
  likesCount: {
    type: Number,
    default: 0,
    min: 0
  },
  featuredInCarousel: {
    type: Boolean,
    default: false
  },
  carouselOrder: {
    type: Number,
    default: 0
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  reviews: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true,
  toJSON: {
    transform(doc, ret) {
      // Replace inline/placeholder images (or an image left out of the query) with the image URL
      if (!isExternalImage(ret.image)) {
        ret.image = imageRoute(ret._id, ret.imageVersion);
      }
      return ret;
    }
  }
});

productSchema.index({ category: 1, displayOrder: 1 });
productSchema.index({ featuredInCarousel: 1, carouselOrder: 1 });

productSchema.pre('save', function () {
  if (this.isNew || this.isModified('image')) {
    this.imageVersion = Date.now();
  }
});

productSchema.pre('findOneAndUpdate', function () {
  const update = this.getUpdate() || {};
  if (update.image !== undefined || update.$set?.image !== undefined) {
    this.set('imageVersion', Date.now());
  }
});

module.exports = mongoose.model('Product', productSchema);
