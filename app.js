// Builds the Express app without starting a server or connecting to MongoDB.
// server.js connects and listens; tests import this file directly with supertest.
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const mongoose = require('mongoose');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();

// Middleware
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  exposedHeaders: ['X-Image-Placeholder']
}));
// Increase payload limits to allow base64 image uploads from the admin UI
const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || '12mb';
app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: JSON_BODY_LIMIT }));

// Request logger (development only; also kept quiet while tests run)
if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.originalUrl}`);
    next();
  });
}

// Health check, used by Docker HEALTHCHECK, docker compose and the hosting platform.
// 200 when the database is connected, 503 otherwise, so a broken instance is reported unhealthy.
const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];
app.get('/api/health', (req, res) => {
  const dbState = DB_STATES[mongoose.connection.readyState] || 'unknown';
  const healthy = dbState === 'connected';
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    db: dbState,
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    // Commit being served: set by the Docker build (APP_VERSION) or by Render (RENDER_GIT_COMMIT).
    // The deploy job polls this to confirm the new version is live.
    version: process.env.APP_VERSION || process.env.RENDER_GIT_COMMIT || 'dev'
  });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/favorites', require('./routes/favorites'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/playlists', require('./routes/playlists'));
app.use('/api/contact', require('./routes/contact'));

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'E-commerce API is running' });
});

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

module.exports = app;
