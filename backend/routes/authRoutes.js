/* ============================================
   AUTH ROUTES
   ============================================ */

const express   = require('express');
const rateLimit = require('express-rate-limit');
const router    = express.Router();

const {
  register,
  login,
  getProfile,
  updateProfile,
  forgotPassword,
  resetPassword,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

/* ============================================
   RATE LIMITERS
   ============================================ */

const loginLimiter = rateLimit({
  windowMs:         15 * 60 * 1000, 
  max:              10,               
  standardHeaders:  true,             
  legacyHeaders:    false,
  // HARDENING: Safely handle clients behind proxies if app.set('trust proxy') is active
  validate: { trustProxy: true }, 
  message: {
    success: false,
    message: 'Too many login attempts. Please try again in 15 minutes.',
  },
});

const registerLimiter = rateLimit({
  windowMs:         60 * 60 * 1000,  
  max:              5,                
  standardHeaders:  true,
  legacyHeaders:    false,
  validate: { trustProxy: true },
  message: {
    success: false,
    message: 'Too many accounts created from this IP. Please try again in an hour.',
  },
});

const passwordResetLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,
  max:              5,
  standardHeaders:  true,
  legacyHeaders:    false,
  validate: { trustProxy: true },
  message: {
    success: false,
    message: 'Too many password reset attempts. Please try again in 15 minutes.',
  },
});

/* ============================================
   ROUTES
   ============================================ */
   
// HARDENING: Consider forcing validation/sanitization middleware here before hitting controllers
router.post('/register', registerLimiter, register);
router.post('/login',    loginLimiter,    login);
router.post('/forgot-password', passwordResetLimiter, forgotPassword);
router.post('/reset-password',  passwordResetLimiter, resetPassword);

// OPTIMIZATION: Clean up repetitive middleware by grouping protected routes
router.use(protect); 

router.route('/profile')
  .get(getProfile)
  .put(updateProfile);

module.exports = router;
