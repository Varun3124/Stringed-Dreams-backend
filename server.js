// Load environment variables before anything reads them
require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('./config/db');
const app = require('./app');

const PORT = process.env.PORT || 5000;

// Only accept requests once the database is connected and startup migrations have run,
// otherwise early requests fail and (for images) show the placeholder
connectDB().then(() => {
  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  // Graceful shutdown: Docker, Render and Ctrl+C send SIGTERM/SIGINT. Stop taking new
  // connections, let in-flight requests finish, close MongoDB, then exit.
  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await mongoose.connection.close(false);
      console.log('Closed HTTP server and MongoDB connection');
      process.exit(0);
    });
    // Force exit if something hangs
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
});
