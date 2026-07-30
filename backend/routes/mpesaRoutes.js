/* ============================================
   M-PESA ROUTES (PRODUCTION-HARDENED)
   ============================================ */

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const {
  initiateSTKPush,
  mpesaCallback,
  querySTKStatus,
  testCredentials,
} = require('../controllers/mpesaController');

const { protect } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/adminMiddleware');

/* ============================================
   PRODUCTION PROTECTION FILTERS
   ============================================ */

// Throttles automated bots trying to brute-force mock transaction details
const callbackLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60,                // Allows max 60 payments per min across your storefront
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many transaction callbacks.' }
});

// Prevents aggressive frontend loops from eating server compute resources
const pollingLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30,                // Restricts a single logged-in user to 1 poll every 2 seconds
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many queries. Please wait a moment.' }
});

/* ============================================
   ROUTES DEFINITION
   ============================================ */

// 1. Live Payment Callbacks (Protected by Rate Limiter, Authorization checked inside Controller)
router.post('/callback', callbackLimiter, mpesaCallback);

// 2. Admin Diagnostic System (Strictly Protected)
router.get('/test', protect, adminOnly, testCredentials);

// 3. Customer Actions (Protected by JWT Auth)
router.post('/stkpush', protect, initiateSTKPush);
router.post('/query', protect, pollingLimiter, querySTKStatus);

module.exports = router;
