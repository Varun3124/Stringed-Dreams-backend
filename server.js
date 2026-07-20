const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/error');

// Load environment variables
dotenv.config();

console.log("Mongo URI:", process.env.MONGO_URI);

// Connect to database
connectDB();

const app = express();

// Middleware
console.log('[DEBUG] CORS origin:', process.env.FRONTEND_URL || 'http://localhost:3000');
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
// Increase payload limits to allow base64 image uploads from the admin UI
const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || '12mb';
app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: JSON_BODY_LIMIT }));

// Request logger
app.use((req, res, next) => {
  console.log(`[DEBUG] ${req.method} ${req.originalUrl} from origin: ${req.headers.origin}`);
  next();
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

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
