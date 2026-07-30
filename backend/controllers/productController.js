/* ============================================
   PRODUCT CONTROLLER
   ============================================ */

const { query, queryOne } = require('../config/db');
const fs = require('fs');
const path = require('path');

const MAX_PAGE_SIZE = 100;
const VALID_CATEGORIES = new Set(['shoes', 'hoodie', 'tshirt', 'jeans', 'dress', 'accessories', 'other']);

const parsePositiveNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};

const parseNonNegativeInteger = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
};

const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
  return false;
};

const getPagination = (page, limit, defaultLimit) => {
  const limitInt = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(limit, 10) || defaultLimit));
  const pageInt = Math.max(1, parseInt(page, 10) || 1);
  return { limitInt, pageInt, offsetInt: (pageInt - 1) * limitInt };
};

const normalizeList = (value, fallback = '') => {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean).join(',');
  if (value === undefined || value === null) return fallback;
  return String(value).split(',').map((item) => item.trim()).filter(Boolean).join(',');
};

const removeUploadedFile = (file) => {
  if (file) fs.unlink(file.path, () => {});
};

const getProducts = async (req, res, next) => {
  try {
    const {
      category,
      search,
      minPrice,
      maxPrice,
      featured,
      sort = 'created_at',
      order = 'DESC',
      page = 1,
      limit = 12,
    } = req.query;

    let whereClause = 'WHERE p.is_active = 1';
    const params = [];

    if (category) {
      const normalizedCategory = String(category).toLowerCase();
      if (!VALID_CATEGORIES.has(normalizedCategory)) {
        return res.status(400).json({ success: false, message: 'Invalid category.' });
      }
      whereClause += ' AND p.category = ?';
      params.push(normalizedCategory);
    }

    if (featured !== undefined) whereClause += ' AND p.is_featured = 1';

    if (minPrice !== undefined) {
      const price = parsePositiveNumber(minPrice);
      if (price === null) return res.status(400).json({ success: false, message: 'Invalid minimum price.' });
      whereClause += ' AND p.price >= ?';
      params.push(price);
    }

    if (maxPrice !== undefined) {
      const price = parsePositiveNumber(maxPrice);
      if (price === null) return res.status(400).json({ success: false, message: 'Invalid maximum price.' });
      whereClause += ' AND p.price <= ?';
      params.push(price);
    }

    if (search) {
      whereClause += ' AND (p.name LIKE ? OR p.description LIKE ? OR p.category LIKE ?)';
      const s = `%${String(search).trim().slice(0, 100)}%`;
      params.push(s, s, s);
    }

    const validSorts = ['created_at', 'price', 'name', 'stock'];
    const validOrders = ['ASC', 'DESC'];
    const sortCol = validSorts.includes(sort) ? sort : 'created_at';
    const sortOrder = validOrders.includes(String(order).toUpperCase()) ? String(order).toUpperCase() : 'DESC';

    const countResult = await query(`SELECT COUNT(*) as total FROM products p ${whereClause}`, params);
    const total = countResult[0].total;
    const { limitInt, pageInt, offsetInt } = getPagination(page, limit, 12);

    const products = await query(
      `SELECT p.id, p.name, p.description, p.price, p.original_price,
              p.category, p.image, p.stock, p.sizes, p.colors,
              p.is_featured, p.created_at
       FROM products p
       ${whereClause}
       ORDER BY p.${sortCol} ${sortOrder}
       LIMIT ${limitInt} OFFSET ${offsetInt}`,
      params
    );

    res.status(200).json({
      success: true,
      total,
      page: pageInt,
      pages: Math.ceil(total / limitInt),
      count: products.length,
      products: products.map(formatProduct),
    });
  } catch (error) {
    next(error);
  }
};

const getProductById = async (req, res, next) => {
  try {
    const product = await queryOne(
      `SELECT id, name, description, price, original_price,
              category, image, stock, sizes, colors,
              is_featured, created_at
       FROM products
       WHERE id = ? AND is_active = 1`,
      [req.params.id]
    );

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    res.status(200).json({ success: true, product: formatProduct(product) });
  } catch (error) {
    next(error);
  }
};

const createProduct = async (req, res, next) => {
  try {
    const {
      name, description, price, originalPrice,
      category, stock, sizes, colors, isFeatured,
    } = req.body;

    if (!name || !description || price === undefined || !category || stock === undefined) {
      removeUploadedFile(req.file);
      return res.status(400).json({
        success: false,
        message: 'Name, description, price, category and stock are required.',
      });
    }

    const normalizedCategory = String(category).toLowerCase();
    if (!VALID_CATEGORIES.has(normalizedCategory)) {
      removeUploadedFile(req.file);
      return res.status(400).json({ success: false, message: `Invalid category. Use: ${Array.from(VALID_CATEGORIES).join(', ')}` });
    }

    const productPrice = parsePositiveNumber(price);
    const productStock = parseNonNegativeInteger(Number(stock));
    const original = originalPrice ? parsePositiveNumber(originalPrice) : null;

    if (productPrice === null || productStock === null || (originalPrice && original === null)) {
      removeUploadedFile(req.file);
      return res.status(400).json({ success: false, message: 'Invalid product price or stock.' });
    }

    const imageFilename = req.file ? req.file.filename : 'default-product.png';

    const result = await query(
      `INSERT INTO products
         (name, description, price, original_price, category,
          image, stock, sizes, colors, is_featured, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(name).trim(),
        String(description).trim(),
        productPrice,
        original,
        normalizedCategory,
        imageFilename,
        productStock,
        normalizeList(sizes, 'S,M,L,XL'),
        normalizeList(colors),
        parseBoolean(isFeatured) ? 1 : 0,
        req.user.id,
      ]
    );

    const product = await queryOne('SELECT * FROM products WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, message: 'Product created successfully.', product: formatProduct(product) });
  } catch (error) {
    removeUploadedFile(req.file);
    next(error);
  }
};

const updateProduct = async (req, res, next) => {
  try {
    const existing = await queryOne('SELECT * FROM products WHERE id = ?', [req.params.id]);

    if (!existing) {
      removeUploadedFile(req.file);
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const {
      name, description, price, originalPrice,
      category, stock, sizes, colors, isFeatured, isActive,
    } = req.body;

    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(String(name).trim());
    }

    if (description !== undefined) {
      updates.push('description = ?');
      values.push(String(description).trim());
    }

    if (price !== undefined) {
      const productPrice = parsePositiveNumber(price);
      if (productPrice === null) {
        removeUploadedFile(req.file);
        return res.status(400).json({ success: false, message: 'Invalid product price.' });
      }
      updates.push('price = ?');
      values.push(productPrice);
    }

    if (originalPrice !== undefined) {
      const original = originalPrice === null || originalPrice === '' ? null : parsePositiveNumber(originalPrice);
      if (originalPrice !== null && originalPrice !== '' && original === null) {
        removeUploadedFile(req.file);
        return res.status(400).json({ success: false, message: 'Invalid original price.' });
      }
      updates.push('original_price = ?');
      values.push(original);
    }

    if (category !== undefined) {
      const normalizedCategory = String(category).toLowerCase();
      if (!VALID_CATEGORIES.has(normalizedCategory)) {
        removeUploadedFile(req.file);
        return res.status(400).json({ success: false, message: `Invalid category. Use: ${Array.from(VALID_CATEGORIES).join(', ')}` });
      }
      updates.push('category = ?');
      values.push(normalizedCategory);
    }

    if (req.file) {
      if (existing.image && existing.image !== 'default-product.png') {
        const oldPath = path.join(__dirname, '..', 'uploads', existing.image);
        if (fs.existsSync(oldPath)) fs.unlink(oldPath, () => {});
      }
      updates.push('image = ?');
      values.push(req.file.filename);
    }

    if (stock !== undefined) {
      const productStock = parseNonNegativeInteger(Number(stock));
      if (productStock === null) {
        removeUploadedFile(req.file);
        return res.status(400).json({ success: false, message: 'Invalid product stock.' });
      }
      updates.push('stock = ?');
      values.push(productStock);
    }

    if (sizes !== undefined) {
      updates.push('sizes = ?');
      values.push(normalizeList(sizes));
    }

    if (colors !== undefined) {
      updates.push('colors = ?');
      values.push(normalizeList(colors));
    }

    if (isFeatured !== undefined) {
      updates.push('is_featured = ?');
      values.push(parseBoolean(isFeatured) ? 1 : 0);
    }

    if (isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(parseBoolean(isActive) ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields provided to update.' });
    }

    values.push(req.params.id);
    await query(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`, values);

    const updated = await queryOne('SELECT * FROM products WHERE id = ?', [req.params.id]);
    res.status(200).json({ success: true, message: 'Product updated successfully.', product: formatProduct(updated) });
  } catch (error) {
    removeUploadedFile(req.file);
    next(error);
  }
};

const deleteProduct = async (req, res, next) => {
  try {
    const product = await queryOne('SELECT * FROM products WHERE id = ?', [req.params.id]);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    if (product.image && product.image !== 'default-product.png') {
      const imgPath = path.join(__dirname, '..', 'uploads', product.image);
      if (fs.existsSync(imgPath)) fs.unlink(imgPath, () => {});
    }

    await query('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.status(200).json({ success: true, message: 'Product deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

const formatProduct = (product) => {
  if (!product) return null;
  return {
    ...product,
    sizes: product.sizes ? product.sizes.split(',').map((s) => s.trim()).filter(Boolean) : [],
    colors: product.colors ? product.colors.split(',').map((c) => c.trim()).filter(Boolean) : [],
    is_featured: product.is_featured === 1,
    is_active: product.is_active === 1,
    price: parseFloat(product.price),
    original_price: product.original_price ? parseFloat(product.original_price) : null,
  };
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};
