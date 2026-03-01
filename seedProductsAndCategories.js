const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Category = require('./models/Category');
const Product = require('./models/Product');

dotenv.config({ path: path.join(__dirname, '.env') });

const categories = [
  {
    name: 'Necklace',
    description: 'Beautiful handcrafted bead necklaces'
  },
  {
    name: 'Earrings',
    description: 'Elegant bead earrings for every occasion'
  }
];

const necklaceProducts = [
  {
    name: 'Crystal Dreams Necklace',
    description: 'Elegant crystal bead necklace with silver clasp. Perfect for evening wear.',
    price: 45.99,
    category: 'Necklace',
    color: 'Clear Silver',
    beadType: 'Crystal',
    image: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=500',
    stock: 15
  },
  {
    name: 'Ocean Blue Statement Necklace',
    description: 'Stunning multi-strand blue glass bead necklace. Makes a bold statement.',
    price: 52.99,
    category: 'Necklace',
    color: 'Ocean Blue',
    beadType: 'Glass',
    image: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=500',
    stock: 12
  },
  {
    name: 'Wooden Harmony Necklace',
    description: 'Natural wooden beads with earth tones. Eco-friendly and stylish.',
    price: 35.99,
    category: 'Necklace',
    color: 'Natural Brown',
    beadType: 'Wood',
    image: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=500',
    stock: 20
  },
  {
    name: 'Rose Quartz Healing Necklace',
    description: 'Beautiful rose quartz beads known for their healing properties.',
    price: 48.99,
    category: 'Necklace',
    color: 'Rose Pink',
    beadType: 'Stone',
    image: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=500',
    stock: 18
  },
  {
    name: 'Turquoise Boho Necklace',
    description: 'Bohemian style turquoise bead necklace with leather cord.',
    price: 42.99,
    category: 'Necklace',
    color: 'Turquoise',
    beadType: 'Stone',
    image: 'https://images.unsplash.com/photo-1506630448388-4e683c67ddb0?w=500',
    stock: 10
  }
];

const earringProducts = [
  {
    name: 'Pearl Drop Earrings',
    description: 'Classic white pearl beads with gold hooks. Timeless elegance.',
    price: 28.99,
    category: 'Earrings',
    color: 'White Pearl',
    beadType: 'Pearl',
    image: 'https://images.unsplash.com/photo-1535556116002-6281ff3e9f75?w=500',
    stock: 25
  },
  {
    name: 'Colorful Fiesta Earrings',
    description: 'Vibrant multi-colored glass beads. Perfect for festivals.',
    price: 22.99,
    category: 'Earrings',
    color: 'Multi-color',
    beadType: 'Glass',
    image: 'https://images.unsplash.com/photo-1596944924616-7b38e7cfac36?w=500',
    stock: 30
  },
  {
    name: 'Emerald Elegance Earrings',
    description: 'Deep green crystal beads with sterling silver. Sophisticated look.',
    price: 34.99,
    category: 'Earrings',
    color: 'Emerald Green',
    beadType: 'Crystal',
    image: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=500',
    stock: 15
  },
  {
    name: 'Amber Sunset Earrings',
    description: 'Warm amber-colored beads. Captures the beauty of sunset.',
    price: 31.99,
    category: 'Earrings',
    color: 'Amber Orange',
    beadType: 'Resin',
    image: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=500',
    stock: 20
  },
  {
    name: 'Black Onyx Dangle Earrings',
    description: 'Sleek black onyx beads with minimalist design.',
    price: 38.99,
    category: 'Earrings',
    color: 'Black',
    beadType: 'Stone',
    image: 'https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?w=500',
    stock: 12
  }
];

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Add new categories
    for (const cat of categories) {
      const exists = await Category.findOne({ name: cat.name });
      if (!exists) {
        await Category.create(cat);
        console.log(`✓ Created category: ${cat.name}`);
      } else {
        console.log(`✓ Category already exists: ${cat.name}`);
      }
    }

    // Add necklace products
    for (const product of necklaceProducts) {
      await Product.create(product);
      console.log(`✓ Added: ${product.name}`);
    }

    // Add earring products
    for (const product of earringProducts) {
      await Product.create(product);
      console.log(`✓ Added: ${product.name}`);
    }

    console.log('\n✅ Successfully seeded categories and products!');
    console.log(`Total: ${categories.length} categories, ${necklaceProducts.length + earringProducts.length} products`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
};

seedData();
