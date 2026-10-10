/* ============================================
   PAULINE FASHION STORE
   Node.js + MySQL Backend Server
   ============================================ */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { connectDB } = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  const requiredEnv = [
    'FRONTEND_URL',
    'JWT_SECRET',
    'DB_HOST',
    'DB_USER',
    'DB_PASSWORD',
    'DB_NAME',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASSWORD',
    'EMAIL_FROM',
  ];

  if (process.env.MPESA_ENABLED === 'true') {
    requiredEnv.push(
      'MPESA_CONSUMER_KEY',
      'MPESA_CONSUMER_SECRET',
      'MPESA_BASE_URL',
      'MPESA_BUSINESS_SHORT_CODE',
      'MPESA_PASSKEY',
      'MPESA_CALLBACK_URL',
      'MPESA_CALLBACK_SECRET',
    );
  }

  const missingEnv = requiredEnv.filter((key) => !process.env[key]);
  if (missingEnv.length > 0) {
    console.error(`Missing required production environment variables: ${missingEnv.join(', ')}`);
    process.exit(1);
  }

  if (process.env.JWT_SECRET.length < 32) {
    console.error('JWT_SECRET must be at least 32 characters in production.');
    process.exit(1);
  }

  try {
    if (new URL(process.env.FRONTEND_URL).protocol !== 'https:') throw new Error();
  } catch {
    console.error('FRONTEND_URL must be a valid HTTPS URL in production.');
    process.exit(1);
  }
}

connectDB();

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

const allowedOrigins = isProduction
  ? [process.env.FRONTEND_URL].filter(Boolean)
  : true;

const corsOptions = {
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 300 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
});

app.use('/api', apiLimiter);
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.URLENCODED_BODY_LIMIT || '1mb' }));

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use('/uploads', express.static(uploadsDir, {
  fallthrough: false,
  immutable: isProduction,
  maxAge: isProduction ? '7d' : 0,
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', isProduction ? 'public, max-age=604800, immutable' : 'no-store');
  },
}));

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Pauline Fashion Store API is running.',
    database: 'MySQL',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/cart', require('./routes/cartRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/mpesa', require('./routes/mpesaRoutes'));

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log('');
  console.log('=====================================');
  console.log('Pauline Fashion Store API');
  console.log(`Port:        ${PORT}`);
  console.log('Database:    MySQL');
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`URL:         http://localhost:${PORT}/api`);
  console.log(`CORS origin: ${isProduction ? process.env.FRONTEND_URL : 'all (dev mode)'}`);
  console.log('=====================================');
  console.log('');
});

module.exports = app;
