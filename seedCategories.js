const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Category = require('./models/Category');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const categories = [
  {
    name: 'Bead Necklace',
    description: 'Beautiful handcrafted bead necklaces in various styles and lengths'
  },
  {
    name: 'Earrings',
    description: 'Elegant bead earrings for every occasion'
  },
  {
    name: 'Bracelet',
    description: 'Stylish bead bracelets and bangles'
  },
  {
    name: 'Anklet',
    description: 'Delicate bead anklets for a unique look'
  },
  {
    name: 'Ring',
    description: 'Handmade bead rings with intricate designs'
  },
  {
    name: 'Choker',
    description: 'Trendy bead choker necklaces'
  }
];

const seedCategories = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing categories
    await Category.deleteMany({});
    console.log('Cleared existing categories');

    // Insert new categories
    await Category.insertMany(categories);
    console.log('Categories seeded successfully!');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding categories:', error);
    process.exit(1);
  }
};

seedCategories();
