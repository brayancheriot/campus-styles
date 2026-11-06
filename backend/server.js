/* ============================================
   PAULINE FASHION STORE
   Node.js + MySQL Backend Server
   ============================================ */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { connectDB, queryOne } = require('./config/db');
const uploadsDir = require('./config/uploads');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  const requiredEnv = [
    'FRONTEND_URL',
    'TRUST_PROXY',
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
    'CONTACT_EMAIL',
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

  const missingEnv = requiredEnv.filter((key) => !process.env[key]?.trim());
  if (missingEnv.length > 0) {
    console.error(`Missing required production environment variables: ${missingEnv.join(', ')}`);
    process.exit(1);
  }

  if (process.env.JWT_SECRET.length < 32) {
    console.error('JWT_SECRET must be at least 32 characters in production.');
    process.exit(1);
  }

  try {
    const frontendUrl = new URL(process.env.FRONTEND_URL);
    if (
      frontendUrl.protocol !== 'https:' ||
      frontendUrl.username ||
      frontendUrl.password ||
      !['', '/'].includes(frontendUrl.pathname) ||
      frontendUrl.search ||
      frontendUrl.hash
    ) {
      throw new Error();
    }
    process.env.FRONTEND_URL = frontendUrl.origin;
  } catch {
    console.error('FRONTEND_URL must be an HTTPS origin without a path, query, or credentials.');
    process.exit(1);
  }

  if (process.env.TRUST_PROXY.trim().toLowerCase() === 'true') {
    console.error('TRUST_PROXY=true is not allowed. Specify a trusted proxy hop count or IP/subnet.');
    process.exit(1);
  }
}

const trustProxyValue = process.env.TRUST_PROXY?.trim();
if (trustProxyValue) {
  const normalizedTrustProxy = trustProxyValue.toLowerCase();
  const trustProxy = normalizedTrustProxy === 'false'
    ? false
    : /^\d+$/.test(trustProxyValue)
    ? Number(trustProxyValue)
    : trustProxyValue.split(',').map((value) => value.trim()).filter(Boolean);
  app.set('trust proxy', trustProxy);
}

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

const allowedOrigins = isProduction
  ? [process.env.FRONTEND_URL].filter(Boolean)
  : true;

const corsOptions = {
  origin: allowedOrigins,
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

app.get('/api/health', async (req, res, next) => {
  try {
    await queryOne('SELECT 1');
    res.json({
      success: true,
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/contact', require('./routes/contactRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/cart', require('./routes/cartRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/mpesa', require('./routes/mpesaRoutes'));

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  return app.listen(PORT, () => {
    console.log('');
    console.log('=====================================');
    console.log('Campus Styles API');
    console.log(`Port:        ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`CORS origin: ${isProduction ? process.env.FRONTEND_URL : 'all (dev mode)'}`);
    console.log('=====================================');
    console.log('');
  });
};

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Unable to start API server:', error.code || error.message);
    process.exitCode = 1;
  });
}

module.exports = app;
module.exports.startServer = startServer;
