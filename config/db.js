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

// Products used to store `color` and `beadType` as single (possibly comma-separated)
// strings. Convert any such legacy documents to the array form. Safe to run repeatedly.
const migrateListFields = async (fields) => {
  const Product = require('../models/Product');
  const normalizeList = require('../utils/normalizeList');

  for (const field of fields) {
    try {
      // Anything that isn't already an array (string, null, or missing).
      // Note: `$type: 'string'` alone would also match arrays that contain strings.
      const legacy = await Product.collection
        .find({ [field]: { $not: { $type: 'array' } } }, { projection: { [field]: 1 } })
        .toArray();

      const bulkOps = legacy.map((doc) => ({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { [field]: normalizeList(doc[field]) } }
        }
      }));

      if (bulkOps.length > 0) {
        await Product.collection.bulkWrite(bulkOps);
      }

      console.log(`Migrated ${field} field to array for ${bulkOps.length} products`);
    } catch (error) {
      console.error(`Error migrating product ${field}:`, error.message);
    }
  }
};

// Give existing products an image version so their image URLs can be cached
const migrateImageVersions = async () => {
  try {
    const Product = require('../models/Product');
    const result = await Product.collection.updateMany(
      { $or: [{ imageVersion: { $exists: false } }, { imageVersion: { $in: [0, null] } }] },
      { $set: { imageVersion: Date.now() } }
    );
    console.log(`Set imageVersion for ${result.modifiedCount} products`);
  } catch (error) {
    console.error('Error setting image versions:', error.message);
  }
};

// Products created before discount prices existed get a discount price equal to their price
const migrateDiscountPrices = async () => {
  try {
    const Product = require('../models/Product');
    // `null` matches both a missing field and an explicit null
    const legacy = await Product.collection
      .find({ discountPrice: null }, { projection: { price: 1 } })
      .toArray();

    const bulkOps = legacy.map((doc) => ({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { discountPrice: Number(doc.price) || 0 } }
      }
    }));

    if (bulkOps.length > 0) {
      await Product.collection.bulkWrite(bulkOps);
    }

    console.log(`Set discountPrice for ${bulkOps.length} products`);
  } catch (error) {
    console.error('Error setting discount prices:', error.message);
  }
};

// Favorites used to keep a copy of each product's (base64) image; drop those copies
const stripFavoriteImageCopies = async () => {
  try {
    const Favorite = require('../models/Favorite');
    const result = await Favorite.collection.updateMany(
      { 'items.image': { $exists: true } },
      { $unset: { 'items.$[].image': '' } }
    );
    console.log(`Removed copied images from ${result.modifiedCount} favorites lists`);
  } catch (error) {
    console.error('Error cleaning favorites images:', error.message);
  }
};

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    await migrateListFields(['color', 'beadType']);
    await migrateImageVersions();
    await migrateDiscountPrices();
    await stripFavoriteImageCopies();
    await syncLikesCount();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
