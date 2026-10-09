const Product = require('../models/Product');
const Category = require('../models/Category');
const normalizeList = require('../utils/normalizeList');

const LIST_FIELDS = ['color', 'beadType'];

// Dashboard order; ties (which the startup migration removes) fall back to creation order
const CATEGORY_ORDER = { displayOrder: 1, createdAt: 1, _id: 1 };

// @desc    Get all products (admin)
// @route   GET /api/admin/products
// @access  Private/Admin
const getAllProducts = async (req, res) => {
  try {
    // Images are served separately (GET /api/products/:id/image)
    const products = await Product.find({}).select('-image -reviews').sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create product
// @route   POST /api/admin/products
// @access  Private/Admin
const toNonNegativeNumber = (value) => {
  if (value === undefined || value === null || value === '') return 0;
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : 0;
};

// Blank means "no discount" (the discount price equals the price). Anything else must be a
// valid amount no higher than the price; unlike other fields it is rejected rather than
// silently defaulted, because a bad value would otherwise turn into a free product.
const parseDiscountPrice = (value, price) => {
  if (value === undefined || value === null || value === '') return price;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    throw new Error('Discount price must be a non-negative number');
  }
  if (num > price) {
    throw new Error("Discount price can't be higher than the price");
  }
  return num;
};

const createProduct = async (req, res) => {
  try {
    const {
      name, description, price, discountPrice, category, color, beadType, image, stock,
      featuredInCarousel, carouselOrder
    } = req.body;

    const priceValue = toNonNegativeNumber(price);

    // Every field is optional; fall back to sensible defaults.
    const product = await Product.create({
      name: String(name || '').trim(),
      description: String(description || ''),
      price: priceValue,
      discountPrice: parseDiscountPrice(discountPrice, priceValue),
      category: String(category || '').trim(),
      color: normalizeList(color),
      beadType: normalizeList(beadType),
      image: image || undefined,
      stock: toNonNegativeNumber(stock),
      featuredInCarousel: Boolean(featuredInCarousel),
      carouselOrder: toNonNegativeNumber(carouselOrder)
    });

    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const touchesPricing = (updates) => 'price' in updates || 'discountPrice' in updates;

// Keeps `discountPrice` consistent when a price or discount is edited, given the product's
// current `price`/`discountPrice`. A product with no discount follows its price; an existing
// discount stays unless the new price drops below it. Sets `updates.discountPrice`.
const resolveDiscountPrice = (current, updates) => {
  const oldPrice = current.price ?? 0;
  const oldDiscount = current.discountPrice ?? oldPrice;
  const price = 'price' in updates ? Number(updates.price) : oldPrice;
  if (!Number.isFinite(price)) return; // schema validation rejects the price

  if ('discountPrice' in updates) {
    updates.discountPrice = parseDiscountPrice(updates.discountPrice, price);
  } else {
    const hadDiscount = oldDiscount < oldPrice;
    updates.discountPrice = hadDiscount && oldDiscount <= price ? oldDiscount : price;
  }
};

const applyDiscountPriceUpdate = async (id, updates) => {
  if (!touchesPricing(updates)) return;
  const current = await Product.findById(id).select('price discountPrice').lean();
  if (!current) return; // the update below reports the 404
  resolveDiscountPrice(current, updates);
};

// @desc    Update product
// @route   PUT /api/admin/products/:id
// @access  Private/Admin
const updateProduct = async (req, res) => {
  try {
    const updates = { ...req.body };
    delete updates.imageVersion; // managed by the model
    LIST_FIELDS.forEach((field) => {
      if (field in updates) updates[field] = normalizeList(updates[field]);
    });
    await applyDiscountPriceUpdate(req.params.id, updates);

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true, projection: { image: 0, reviews: 0 } }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json(updatedProduct);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const BULK_UPDATE_FIELDS = ['color', 'beadType', 'price', 'discountPrice', 'stock', 'featuredInCarousel'];

const toValidAmount = (value, label) => {
  const num = Number(value);
  if (value === '' || value === null || !Number.isFinite(num) || num < 0) {
    throw new Error(`${label} must be a non-negative number`);
  }
  return num;
};

// @desc    Apply per-product changes to many products at once (admin multi-select)
// @route   PUT /api/admin/products/bulk-update
// @access  Private/Admin
const bulkUpdateProducts = async (req, res) => {
  try {
    const { updates } = req.body; // Array of { id, changes }

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ message: 'No products provided' });
    }

    const current = await Product.find({ _id: { $in: updates.map((u) => u?.id) } })
      .select('price discountPrice')
      .lean();
    const currentById = new Map(current.map((p) => [String(p._id), p]));

    // Validate everything before writing, so a bad entry doesn't leave a half-applied edit
    const operations = [];
    updates.forEach(({ id, changes } = {}) => {
      const product = currentById.get(String(id));
      if (!product) throw new Error(`Product not found: ${id}`);

      const set = {};
      BULK_UPDATE_FIELDS.forEach((field) => {
        if (changes && field in changes) set[field] = changes[field];
      });
      LIST_FIELDS.forEach((field) => {
        if (field in set) set[field] = normalizeList(set[field]);
      });
      if ('price' in set) set.price = toValidAmount(set.price, 'Price');
      if ('stock' in set) set.stock = toValidAmount(set.stock, 'Stock');
      if ('featuredInCarousel' in set) set.featuredInCarousel = Boolean(set.featuredInCarousel);
      if (touchesPricing(set)) resolveDiscountPrice(product, set);

      if (Object.keys(set).length > 0) {
        operations.push({ updateOne: { filter: { _id: product._id }, update: { $set: set } } });
      }
    });

    const result = operations.length > 0 ? await Product.bulkWrite(operations) : { matchedCount: 0 };
    res.json({ message: 'Products updated', matched: result.matchedCount });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete product
// @route   DELETE /api/admin/products/:id
// @access  Private/Admin
const deleteProduct = async (req, res) => {
  try {
    // Raw document (with its image and reviews), so the admin page can undo the delete
    const product = await Product.findById(req.params.id).lean();

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted successfully', product });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Put back a deleted product with its original id (admin undo)
// @route   POST /api/admin/products/restore
// @access  Private/Admin
const restoreProduct = async (req, res) => {
  try {
    const { product } = req.body; // the document returned by DELETE /admin/products/:id
    if (!product?._id) {
      return res.status(400).json({ message: 'No product to restore' });
    }
    if (await Product.exists({ _id: product._id })) {
      return res.status(409).json({ message: 'Product already exists' });
    }

    // Same id, so favorites and collections that still point at it work again
    const restored = await Product.create(product);
    const json = restored.toJSON();
    delete json.reviews;
    res.status(201).json(json);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get all categories
// @route   GET /api/admin/categories
// @access  Private/Admin
const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find({}).sort(CATEGORY_ORDER);
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Put back a deleted category with its original id (admin undo)
// @route   POST /api/admin/categories/restore
// @access  Private/Admin
const restoreCategory = async (req, res) => {
  try {
    const { _id, name, description, displayOrder } = req.body;
    if (!_id || !name) {
      return res.status(400).json({ message: 'No category to restore' });
    }
    if (await Category.exists({ $or: [{ _id }, { name }] })) {
      return res.status(409).json({ message: 'Category already exists' });
    }

    const category = await Category.create({ _id, name, description, displayOrder });
    res.status(201).json(category);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Create category
// @route   POST /api/admin/categories
// @access  Private/Admin
const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    const categoryExists = await Category.findOne({ name });
    if (categoryExists) {
      return res.status(400).json({ message: 'Category already exists' });
    }

    // New categories go after the existing ones
    const last = await Category.findOne({}).sort({ displayOrder: -1 }).select('displayOrder').lean();
    const category = await Category.create({ name, description, displayOrder: (last?.displayOrder ?? -1) + 1 });
    res.status(201).json(category);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update category
// @route   PUT /api/admin/categories/:id
// @access  Private/Admin
const updateCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const updatedCategory = await Category.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    // Products reference categories by name, so carry them over on rename.
    if (updatedCategory.name !== category.name) {
      await Product.updateMany({ category: category.name }, { category: updatedCategory.name });
    }

    res.json(updatedCategory);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Reorder categories (their order on the dashboard)
// @route   PUT /api/admin/categories/reorder
// @access  Private/Admin
const reorderCategories = async (req, res) => {
  try {
    const { categories } = req.body; // Array of { id, displayOrder }

    if (!Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({ message: 'No categories provided' });
    }

    const result = await Category.bulkWrite(
      categories.map(({ id, displayOrder }) => ({
        updateOne: { filter: { _id: id }, update: { displayOrder: Number(displayOrder) || 0 } }
      }))
    );

    res.json({ message: 'Categories reordered', matched: result.matchedCount });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete category
// @route   DELETE /api/admin/categories/:id
// @access  Private/Admin
const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Check if any products use this category
    const productsWithCategory = await Product.countDocuments({ category: category.name });
    if (productsWithCategory > 0) {
      return res.status(400).json({ 
        message: `Cannot delete category. ${productsWithCategory} product(s) are using this category.` 
      });
    }

    await Category.findByIdAndDelete(req.params.id);
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update product carousel settings
// @route   PUT /api/admin/products/:id/carousel
// @access  Private/Admin
const updateProductCarousel = async (req, res) => {
  try {
    const { featuredInCarousel, carouselOrder } = req.body;
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    product.featuredInCarousel = featuredInCarousel;
    product.carouselOrder = carouselOrder;
    
    await product.save();
    res.json(product);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Reorder products within a category
// @route   PUT /api/admin/products/reorder
// @access  Private/Admin
const reorderProducts = async (req, res) => {
  try {
    const { products } = req.body; // Array of { id, displayOrder }

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ message: 'No products provided' });
    }

    // Update all products in a single round trip
    const result = await Product.bulkWrite(
      products.map(({ id, displayOrder }) => ({
        updateOne: { filter: { _id: id }, update: { displayOrder } }
      }))
    );

    res.json({ message: 'Products reordered', matched: result.matchedCount });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getCategoryFallbackPrice = async (category, priceCache) => {
  if (priceCache.has(category)) {
    return priceCache.get(category);
  }

  const latestProduct = await Product.findOne({ category, stock: { $gt: 0 } })
    .sort({ createdAt: -1, _id: -1 })
    .select('price')
    .lean();

  const fallbackPrice = latestProduct?.price ?? 0;
  priceCache.set(category, fallbackPrice);
  return fallbackPrice;
};

// @desc    Bulk create products
// @route   POST /api/admin/products/bulk
// @access  Private/Admin
const bulkCreateProducts = async (req, res) => {
  try {
    const { products: productsList, category: batchCategory } = req.body;
    
    if (!Array.isArray(productsList) || productsList.length === 0) {
      return res.status(400).json({ message: 'No products provided' });
    }

    const results = { created: 0, failed: 0, errors: [], products: [] };
    const priceCache = new Map();

    // Validate payload sizes: per-image and total
    const MAX_IMAGE_BYTES = parseInt(process.env.MAX_IMAGE_BYTES || String(2 * 1024 * 1024), 10); // 2MB default per image
    const MAX_TOTAL_BYTES = parseInt(process.env.MAX_TOTAL_BYTES || String(20 * 1024 * 1024), 10); // 20MB total default

    const extractBase64 = (dataUrl) => {
      if (!dataUrl || typeof dataUrl !== 'string') return null;
      const idx = dataUrl.indexOf(',');
      return idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
    };

    let totalBytes = 0;
    for (let i = 0; i < productsList.length; i++) {
      const p = productsList[i];
      const b64 = extractBase64(p.image);
      if (!b64) {
        return res.status(400).json({ message: `Image missing or invalid at row ${i + 1}` });
      }
      // approximate bytes from base64 length
      const bytes = Math.round((b64.length * 3) / 4);
      if (bytes > MAX_IMAGE_BYTES) {
        return res.status(413).json({ message: `Image at row ${i + 1} exceeds per-image size limit (${Math.round(bytes / 1024)} KB)` });
      }
      totalBytes += bytes;
      if (totalBytes > MAX_TOTAL_BYTES) {
        return res.status(413).json({ message: `Total upload size exceeds limit` });
      }
    }

    for (let i = 0; i < productsList.length; i++) {
      try {
        const p = productsList[i];
        const category = String(p.category || batchCategory || '').trim();

        if (!category) {
          throw new Error('Category is required for each bulk product');
        }

        if (!p.image) {
          throw new Error('Image is required for each bulk product');
        }

        const fallbackPrice = await getCategoryFallbackPrice(category, priceCache);

        const created = await Product.create({
          name: '',
          description: '',
          price: fallbackPrice,
          category,
          color: [],
          beadType: [],
          image: p.image,
          stock: 1
        });
        results.created++;
        // Serialized without the inline image (see the Product toJSON transform)
        results.products.push({ index: i + 1, product: created });
      } catch (err) {
        results.failed++;
        results.errors.push({ row: i + 1, error: err.message });
      }
    }

    res.status(201).json(results);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Duplicate product
// @route   POST /api/admin/products/:id/duplicate
// @access  Private/Admin
const duplicateProduct = async (req, res) => {
  try {
    const original = await Product.findById(req.params.id);
    if (!original) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const duplicate = await Product.create({
      name: `${original.name} (Copy)`,
      description: original.description,
      price: original.price,
      discountPrice: original.discountPrice,
      category: original.category,
      color: normalizeList(original.color),
      beadType: normalizeList(original.beadType),
      image: original.image,
      stock: original.stock
    });

    res.status(201).json(duplicate);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
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
};
