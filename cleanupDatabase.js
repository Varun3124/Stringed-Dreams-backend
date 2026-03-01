const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const cleanupDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // Get all collections
    const collections = await db.listCollections().toArray();
    console.log('\nExisting collections:', collections.map(c => c.name).join(', '));

    // Remove orders collection if it exists
    const ordersExists = collections.find(c => c.name === 'orders');
    if (ordersExists) {
      await db.collection('orders').drop();
      console.log('✓ Removed "orders" collection');
    } else {
      console.log('✓ "orders" collection does not exist (already clean)');
    }

    // Remove old carts collection (renamed to favorites)
    const cartsExists = collections.find(c => c.name === 'carts');
    if (cartsExists) {
      await db.collection('carts').drop();
      console.log('✓ Removed "carts" collection (replaced by favorites)');
    } else {
      console.log('✓ "carts" collection does not exist (already clean)');
    }

    // Clear all old products
    const productsCollection = db.collection('products');
    const result = await productsCollection.deleteMany({});
    console.log(`✓ Removed ${result.deletedCount} old product(s) from "products" collection`);

    // Verify categories exist
    const categoriesCount = await db.collection('categories').countDocuments();
    console.log(`✓ Categories table has ${categoriesCount} categories`);

    console.log('\n✅ Database cleanup complete!');
    console.log('\nNext steps:');
    console.log('1. Backend API is already connected');
    console.log('2. Start backend: npm run dev');
    console.log('3. Login as admin and add your bead jewelry products');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error cleaning up database:', error);
    process.exit(1);
  }
};

cleanupDatabase();
