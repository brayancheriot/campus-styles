const express = require('express');
const router  = express.Router();
const {
  placeOrder, getMyOrders, getOrderById,
  getAllOrders, updateOrderStatus,
} = require('../controllers/orderController');
const { protect }   = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/adminMiddleware');

router.use(protect); // All order routes require login

/* Customer routes */
router.post('/',          placeOrder);
router.get ('/myorders',  getMyOrders);
router.get ('/:id',       getOrderById);

/* Admin routes */
router.get ('/',    adminOnly, getAllOrders);
router.put ('/:id', adminOnly, updateOrderStatus);

module.exports = router;