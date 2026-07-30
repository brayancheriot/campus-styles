/* ============================================
   ADMIN MIDDLEWARE — Role Based Access
   ============================================ */

/* ---- Allow only admin users ---- */
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.',
    });
  }
};

module.exports = { adminOnly };