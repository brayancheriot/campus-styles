/* ============================================
   CART CONTROLLER
   ============================================ */

const { query, queryOne } = require('../config/db');

/* ============================================
   GET /api/cart
   ============================================ */
const getCart = async (req, res, next) => {
  try {
    /* ---- Get all cart items with product details ---- */
    const items = await query(
      `SELECT
         c.id,
         c.product_id,
         c.quantity,
         c.size,
         c.color,
         c.price_at_add,
         p.name,
         p.image,
         p.category,
         p.stock,
         p.is_active
       FROM cart c
       JOIN products p ON c.product_id = p.id
       WHERE c.user_id = ?
       ORDER BY c.created_at DESC`,
      [req.user.id]
    );

    /* ---- Filter out inactive products ---- */
    const activeItems = items.filter(item => item.is_active);

    /* ---- Remove inactive items from DB ---- */
    const inactiveIds = items
      .filter(i => !i.is_active)
      .map(i => i.id);

    if (inactiveIds.length > 0) {
      await query(
        `DELETE FROM cart WHERE id IN (${inactiveIds.map(() => '?').join(',')})`,
        inactiveIds
      );
    }

    /* ---- Calculate totals ---- */
    const totalItems = activeItems.reduce((sum, i) => sum + i.quantity, 0);
    const totalPrice = activeItems.reduce(
      (sum, i) => sum + parseFloat(i.price_at_add) * i.quantity, 0
    );

    res.status(200).json({
      success: true,
      cart: {
        items:      activeItems,
        totalItems,
        totalPrice: parseFloat(totalPrice.toFixed(2)),
      },
    });

  } catch (error) {
    next(error);
  }
};

/* ============================================
   POST /api/cart/add
   ============================================ */
const addToCart = async (req, res, next) => {
  try {
    const { productId, quantity = 1, size = '', color = '' } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required.',
      });
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a positive number.',
      });
    }

    /* ---- Check product exists and has stock ---- */
    const product = await queryOne(
      'SELECT id, name, price, stock, is_active FROM products WHERE id = ?',
      [productId]
    );

    if (!product || !product.is_active) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or no longer available.',
      });
    }

    if (product.stock < qty) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.stock} items left in stock.`,
      });
    }

    /* ---- Check if item already in cart ---- */
    const existing = await queryOne(
      `SELECT id, quantity FROM cart
       WHERE user_id = ? AND product_id = ? AND size = ? AND color = ?`,
      [req.user.id, productId, size, color]
    );

    if (existing) {
      /* ---- Update quantity ---- */
      const newQty = Math.min(existing.quantity + qty, 10);

      if (newQty > product.stock) {
        return res.status(400).json({
          success: false,
          message: `Cannot add more. Only ${product.stock} available.`,
        });
      }

      await query(
        'UPDATE cart SET quantity = ?, price_at_add = ? WHERE id = ?',
        [newQty, product.price, existing.id]
      );
    } else {
      /* ---- Insert new cart item ---- */
      await query(
        `INSERT INTO cart (user_id, product_id, quantity, size, color, price_at_add)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [req.user.id, productId, Math.min(qty, 10), size, color, product.price]
      );
    }

    /* ---- Return updated cart ---- */
    const cartResponse = await getCartData(req.user.id);

    res.status(200).json({
      success: true,
      message: `${product.name} added to cart.`,
      cart:    cartResponse,
    });

  } catch (error) {
    next(error);
  }
};

/* ============================================
   PUT /api/cart/update
   ============================================ */
const updateCartItem = async (req, res, next) => {
  try {
    const { productId, quantity, size = '', color = '' } = req.body;

    if (!productId || quantity === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Product ID and quantity are required.',
      });
    }

    const qty = parseInt(quantity, 10);

    /* ---- Find cart item ---- */
    const cartItem = await queryOne(
      `SELECT id FROM cart
       WHERE user_id = ? AND product_id = ? AND size = ? AND color = ?`,
      [req.user.id, productId, size, color]
    );

    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart.',
      });
    }

    if (isNaN(qty)) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a valid number.',
      });
    }

    if (qty <= 0) {
      /* ---- Remove item ---- */
      await query('DELETE FROM cart WHERE id = ?', [cartItem.id]);
    } else {
      /* ---- Check stock ---- */
      const product = await queryOne(
        'SELECT stock FROM products WHERE id = ?',
        [productId]
      );

      if (product && qty > product.stock) {
        return res.status(400).json({
          success: false,
          message: `Only ${product.stock} items available.`,
        });
      }

      /* ---- Update quantity ---- */
      await query(
        'UPDATE cart SET quantity = ? WHERE id = ?',
        [Math.min(qty, 10), cartItem.id]
      );
    }

    const cartResponse = await getCartData(req.user.id);

    res.status(200).json({
      success: true,
      message: 'Cart updated.',
      cart:    cartResponse,
    });

  } catch (error) {
    next(error);
  }
};

/* ============================================
   DELETE /api/cart/remove/:productId
   ============================================ */
const removeFromCart = async (req, res, next) => {
  try {
    const { productId }      = req.params;
    const { size = '', color = '' } = req.query;

    const result = await query(
      `DELETE FROM cart
       WHERE user_id = ? AND product_id = ? AND size = ? AND color = ?`,
      [req.user.id, productId, size, color]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart.',
      });
    }

    const cartResponse = await getCartData(req.user.id);

    res.status(200).json({
      success: true,
      message: 'Item removed from cart.',
      cart:    cartResponse,
    });

  } catch (error) {
    next(error);
  }
};

/* ============================================
   DELETE /api/cart/clear
   ============================================ */
const clearCart = async (req, res, next) => {
  try {
    await query('DELETE FROM cart WHERE user_id = ?', [req.user.id]);

    res.status(200).json({
      success: true,
      message: 'Cart cleared.',
      cart:    { items: [], totalItems: 0, totalPrice: 0 },
    });

  } catch (error) {
    next(error);
  }
};

/* ============================================
   HELPER â€” get formatted cart data
   ============================================ */
const getCartData = async (userId) => {
  const items = await query(
    `SELECT c.id, c.product_id, c.quantity, c.size, c.color,
            c.price_at_add, p.name, p.image, p.category, p.stock
     FROM cart c
     JOIN products p ON c.product_id = p.id
     WHERE c.user_id = ? AND p.is_active = 1
     ORDER BY c.created_at DESC`,
    [userId]
  );

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = items.reduce(
    (s, i) => s + parseFloat(i.price_at_add) * i.quantity, 0
  );

  return {
    items,
    totalItems,
    totalPrice: parseFloat(totalPrice.toFixed(2)),
  };
};

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
};
