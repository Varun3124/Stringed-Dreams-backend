const mongoose = require('mongoose');

const syncLikesCount = async () => {
  try {
    const Favorite = require('../models/Favorite');
    const Product = require('../models/Product');

    // Aggregate: unwind all favorite items, group by product, count
    const counts = await Favorite.aggregate([
      { $unwind: '$items' },
      { $group: { _id: '$items.product', count: { $sum: 1 } } }
    ]);

    // Build a map of productId -> count
    const likesMap = {};
    counts.forEach(c => { likesMap[c._id.toString()] = c.count; });

    // Reset all products to 0, then set actual counts
    await Product.updateMany({}, { likesCount: 0 });

    const bulkOps = counts.map(c => ({
      updateOne: {
        filter: { _id: c._id },
        update: { likesCount: c.count }
      }
    }));

    if (bulkOps.length > 0) {
      await Product.bulkWrite(bulkOps);
    }

    console.log(`Synced likesCount for ${counts.length} products`);
  } catch (error) {
    console.error('Error syncing likesCount:', error.message);
  }
};

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    await syncLikesCount();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
