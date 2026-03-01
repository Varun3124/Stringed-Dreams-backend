const Product = require('../models/Product');
const Category = require('../models/Category');

// @desc    Get all products (admin)
// @route   GET /api/admin/products
// @access  Private/Admin
const getAllProducts = async (req, res) => {
  try {
    const products = await Product.find({}).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create product
// @route   POST /api/admin/products
// @access  Private/Admin
const createProduct = async (req, res) => {
  try {
    const { name, description, price, category, color, beadType, image, stock } = req.body;

    const product = await Product.create({
      name,
      description,
      price,
      category,
      color,
      beadType,
      image,
      stock
    });

    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update product
// @route   PUT /api/admin/products/:id
// @access  Private/Admin
const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.json(updatedProduct);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete product
// @route   DELETE /api/admin/products/:id
// @access  Private/Admin
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all categories
// @route   GET /api/admin/categories
// @access  Private/Admin
const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find({}).sort({ name: 1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
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

    const category = await Category.create({ name, description });
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

    res.json(updatedCategory);
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
    
    // Update all products in a batch
    const updatePromises = products.map(({ id, displayOrder }) =>
      Product.findByIdAndUpdate(id, { displayOrder }, { new: true })
    );
    
    await Promise.all(updatePromises);
    
    const updatedProducts = await Product.find({}).sort({ createdAt: -1 });
    res.json(updatedProducts);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Bulk create products
// @route   POST /api/admin/products/bulk
// @access  Private/Admin
const bulkCreateProducts = async (req, res) => {
  try {
    const { products: productsList } = req.body;
    
    if (!Array.isArray(productsList) || productsList.length === 0) {
      return res.status(400).json({ message: 'No products provided' });
    }

    const results = { created: 0, failed: 0, errors: [] };

    for (let i = 0; i < productsList.length; i++) {
      try {
        const p = productsList[i];
        await Product.create({
          name: p.name || `Product ${i + 1}`,
          description: p.description || '',
          price: parseFloat(p.price) || 0,
          category: p.category || 'Uncategorized',
          color: p.color || '',
          beadType: p.beadType || '',
          image: p.image || '',
          stock: parseInt(p.stock) || 0
        });
        results.created++;
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
      category: original.category,
      color: original.color,
      beadType: original.beadType,
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
  deleteProduct,
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  updateProductCarousel,
  reorderProducts,
  bulkCreateProducts,
  duplicateProduct
};
