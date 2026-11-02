const express = require('express');
const rateLimit = require('express-rate-limit');
const { sendContactMessage } = require('../controllers/contactController');

const router = express.Router();

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many messages sent. Please try again later.' },
});

router.post('/', contactLimiter, sendContactMessage);

module.exports = router;