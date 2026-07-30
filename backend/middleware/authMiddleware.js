/* ============================================
   AUTH MIDDLEWARE — Verify JWT Token
   ============================================ */

const jwt           = require('jsonwebtoken');
const { queryOne }  = require('../config/db');

/* ---- Protect route — require valid JWT ---- */
const protect = async (req, res, next) => {
  try {
    let token;

    // Get token from Authorization header
    // Format: "Authorization: Bearer TOKEN"
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    // No token provided
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized. Please log in.',
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database
    const user = await queryOne(
      'SELECT id, name, email, role, phone, is_active FROM users WHERE id = ?',
      [decoded.id]
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User no longer exists.',
      });
    }

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Account deactivated. Contact support.',
      });
    }

    // Attach user to request object
    req.user = user;
    next();

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Session expired. Please log in again.',
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please log in again.',
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Not authorized.',
    });
  }
};

module.exports = { protect };