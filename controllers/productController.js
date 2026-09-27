const Product = require('../models/Product');

const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// @desc    Get all products
// @route   GET /api/products
// @access  Public
const getProducts = async (req, res) => {
  try {
    const { keyword, category, minPrice, maxPrice, sort } = req.query;

    let query = {};

    // Search by keyword
    if (keyword) {
      query.name = { $regex: escapeRegex(keyword), $options: 'i' };
    }

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Filter by price range
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    let sortOption = {};
    if (sort === 'price-asc') sortOption.price = 1;
    else if (sort === 'price-desc') sortOption.price = -1;
    else if (sort === 'rating') sortOption.rating = -1;
    else sortOption.createdAt = -1;

    // Images are served separately (GET /api/products/:id/image) so lists stay small
    const products = await Product.find(query).select('-image -reviews').sort(sortOption);

    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).select('-image');

    if (product) {
      res.json(product);
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create product review
// @route   POST /api/products/:id/reviews
// @access  Private
const createProductReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const product = await Product.findById(req.params.id);

    if (product) {
      const alreadyReviewed = product.reviews.find(
        (review) => review.user.toString() === req.user._id.toString()
      );

      if (alreadyReviewed) {
        return res.status(400).json({ message: 'Product already reviewed' });
      }

      const review = {
        name: req.user.name,
        rating: Number(rating),
        comment,
        user: req.user._id
      };

      product.reviews.push(review);
      product.numReviews = product.reviews.length;
      product.rating = product.reviews.reduce((acc, item) => item.rating + acc, 0) / product.reviews.length;

      await product.save();
      res.status(201).json({ message: 'Review added' });
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
<rect width="400" height="400" fill="#f0e6f6"/>
<g fill="none" stroke="#9d4edd" stroke-width="10" opacity="0.45">
<circle cx="140" cy="200" r="28"/><circle cx="200" cy="200" r="28"/><circle cx="260" cy="200" r="28"/>
</g>
</svg>`;

// Stored images may be user-supplied SVG; never let them run scripts when opened directly
const IMAGE_SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox"
};

const sendPlaceholder = (res) => {
  res.set({ ...IMAGE_SECURITY_HEADERS, 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' });
  res.send(PLACEHOLDER_SVG);
};

// @desc    Get a product's image as a cacheable file
// @route   GET /api/products/:id/image?v=<imageVersion>
// @access  Public
const getProductImage = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).select('image imageVersion').lean();
    if (!product) return sendPlaceholder(res.status(404));

    const { image, imageVersion } = product;

    if (typeof image === 'string' && image.startsWith('data:')) {
      const comma = image.indexOf(',');
      const header = image.slice(5, comma);
      const isBase64 = header.endsWith(';base64');
      const mime = header.replace(/;base64$/, '').split(';')[0].trim().toLowerCase();
      if (comma < 0 || !mime.startsWith('image/')) return sendPlaceholder(res);

      const payload = image.slice(comma + 1);
      const buffer = isBase64 ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload));

      // The URL carries the version, so a matching request can be cached forever
      const versionMatches = String(req.query.v) === String(imageVersion || 0);
      res.set({
        ...IMAGE_SECURITY_HEADERS,
        'Content-Type': mime,
        'Cache-Control': versionMatches ? 'public, max-age=31536000, immutable' : 'public, max-age=300',
        ETag: `"${product._id}-${imageVersion || 0}"`
      });
      return res.send(buffer);
    }

    if (typeof image === 'string' && /^https?:\/\//i.test(image) && !image.includes('via.placeholder.com')) {
      res.set('Cache-Control', 'public, max-age=86400');
      return res.redirect(302, image);
    }

    return sendPlaceholder(res);
  } catch (error) {
    return sendPlaceholder(res.status(error.name === 'CastError' ? 404 : 500));
  }
};

module.exports = {
  getProducts,
  getProductById,
  getProductImage,
  createProductReview
};
