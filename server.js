const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const compression = require('compression');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/error');

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Middleware
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
// Increase payload limits to allow base64 image uploads from the admin UI
const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || '12mb';
app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: JSON_BODY_LIMIT }));

// Request logger (development only)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.originalUrl}`);
    next();
  });
}

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

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
