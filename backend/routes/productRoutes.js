const express = require('express');
const router = express.Router();
const {
  getProducts, getProductById,
  createProduct, updateProduct, deleteProduct,
} = require('../controllers/productController');
const { protect } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/adminMiddleware');
const { upload, handleUploadError, verifyUploadedImage } = require('../middleware/uploadMiddleware');

router.get('/', getProducts);
router.get('/:id', getProductById);

router.post('/',
  protect, adminOnly,
  upload.single('image'), handleUploadError, verifyUploadedImage,
  createProduct
);

router.put('/:id',
  protect, adminOnly,
  upload.single('image'), handleUploadError, verifyUploadedImage,
  updateProduct
);

router.delete('/:id', protect, adminOnly, deleteProduct);

module.exports = router;
