/* ============================================
   ORDER CONTROLLER
   ============================================ */

const { query, queryOne, transaction } = require('../config/db');
const { notifyOrderCreated } = require('../utils/whatsappNotifier');

const DEPOSIT_RATE = 0.20;
const SHIPPING_COST = 0;
const MAX_PAGE_SIZE = 100;
const ORDER_STATUSES = new Set(['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled']);
const PAYMENT_STATUSES = new Set(['Pay on Delivery', 'Unpaid', 'Pending STK', 'Deposit Paid', 'Paid', 'Refunded']);

const getPagination = (page, limit, defaultLimit) => {
  const limitInt = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(limit, 10) || defaultLimit));
  const pageInt = Math.max(1, parseInt(page, 10) || 1);
  return { limitInt, pageInt, offsetInt: (pageInt - 1) * limitInt };
};

const placeOrder = async (req, res, next) => {
  try {
    const {
      shippingAddress,
      paymentMethod = 'M-Pesa',
      deliveryNotes = '',
      paymentType = 'deposit',
    } = req.body;

    if (
      !shippingAddress?.fullName ||
      !shippingAddress?.phone ||
      !shippingAddress?.street ||
      !shippingAddress?.city
    ) {
      return res.status(400).json({
        success: false,
        message: 'Full name, phone, street and city are required.',
      });
    }

    const orderId = await transaction(async (conn) => {
      const [cartItems] = await conn.execute(
        `SELECT c.product_id, c.quantity, c.size, c.color,
                c.price_at_add, p.name, p.image, p.stock, p.is_active
         FROM cart c
         JOIN products p ON c.product_id = p.id
         WHERE c.user_id = ?
         FOR UPDATE`,
        [req.user.id]
      );

      if (!cartItems || cartItems.length === 0) {
        const error = new Error('Cart is empty. Add items before placing an order.');
        error.statusCode = 400;
        throw error;
      }

      for (const item of cartItems) {
        if (!item.is_active) {
          const error = new Error(`"${item.name}" is no longer available.`);
          error.statusCode = 400;
          throw error;
        }
        if (item.stock < item.quantity) {
          const error = new Error(`Only ${item.stock} "${item.name}" left in stock.`);
          error.statusCode = 400;
          throw error;
        }
      }

      const subtotal = cartItems.reduce(
        (sum, i) => sum + parseFloat(i.price_at_add) * i.quantity,
        0
      );
      const totalPrice = subtotal;
      const payOnDelivery = paymentType === 'cod' || paymentMethod === 'Cash on Delivery';
      const payInFull = paymentType === 'full';
      const depositAmount = payOnDelivery
        ? 0
        : payInFull
        ? parseFloat(totalPrice.toFixed(2))
        : parseFloat((totalPrice * DEPOSIT_RATE).toFixed(2));
      const balanceDue = payOnDelivery
        ? parseFloat(totalPrice.toFixed(2))
        : payInFull
        ? 0
        : parseFloat((totalPrice * (1 - DEPOSIT_RATE)).toFixed(2));
      const paymentStatus = payOnDelivery ? 'Pay on Delivery' : 'Unpaid';
      const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
      const trackingNumber = `PF-${Date.now().toString().slice(-6)}-${rand}`;

      const [orderResult] = await conn.execute(
        `INSERT INTO orders
           (user_id, total_price, deposit_amount, balance_due, shipping_cost,
            full_name, phone, street, city, county, country,
            delivery_notes, payment_method, payment_reference,
            payment_status, tracking_number)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.id,
          totalPrice,
          depositAmount,
          balanceDue,
          SHIPPING_COST,
          String(shippingAddress.fullName).trim(),
          String(shippingAddress.phone).trim(),
          String(shippingAddress.street).trim(),
          String(shippingAddress.city).trim(),
          shippingAddress.county ? String(shippingAddress.county).trim() : '',
          shippingAddress.country ? String(shippingAddress.country).trim() : 'Kenya',
          String(deliveryNotes || '').trim(),
          paymentMethod,
          '',
          paymentStatus,
          trackingNumber,
        ]
      );

      const newOrderId = orderResult.insertId;

      for (const item of cartItems) {
        const [stockResult] = await conn.execute(
          'UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?',
          [item.quantity, item.product_id, item.quantity]
        );

        if (stockResult.affectedRows !== 1) {
          const error = new Error(`Insufficient stock for "${item.name}".`);
          error.statusCode = 400;
          throw error;
        }

        await conn.execute(
          `INSERT INTO order_items
             (order_id, product_id, name, image, price, quantity, size, color)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newOrderId,
            item.product_id,
            item.name,
            item.image,
            parseFloat(item.price_at_add),
            item.quantity,
            item.size,
            item.color,
          ]
        );
      }

      await conn.execute('DELETE FROM cart WHERE user_id = ?', [req.user.id]);
      return newOrderId;
    });

    const order = await getOrderDetails(orderId);
    notifyOrderCreated(order).catch((error) => {
      console.error('WhatsApp order notification failed:', error.response?.data || error.message);
    });

    res.status(201).json({
      success: true,
      message: 'Order placed successfully.',
      order,
    });
  } catch (error) {
    next(error);
  }
};

const getMyOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    let whereClause = 'WHERE o.user_id = ?';
    const params = [req.user.id];

    if (status) {
      whereClause += ' AND o.order_status = ?';
      params.push(status);
    }

    const countResult = await query(`SELECT COUNT(*) as total FROM orders o ${whereClause}`, params);
    const total = countResult[0].total;
    const { limitInt, pageInt, offsetInt } = getPagination(page, limit, 10);

    const orders = await query(
      `SELECT o.id, o.total_price, o.deposit_amount, o.balance_due,
              o.order_status, o.payment_status, o.payment_method,
              o.tracking_number, o.full_name, o.city, o.created_at
       FROM orders o
       ${whereClause}
       ORDER BY o.created_at DESC
       LIMIT ${limitInt} OFFSET ${offsetInt}`,
      params
    );

    const ordersWithCount = await Promise.all(
      orders.map(async (order) => {
        const itemCount = await queryOne('SELECT COUNT(*) as count FROM order_items WHERE order_id = ?', [order.id]);
        return { ...order, item_count: itemCount.count };
      })
    );

    res.status(200).json({
      success: true,
      total,
      page: pageInt,
      pages: Math.ceil(total / limitInt),
      orders: ordersWithCount,
    });
  } catch (error) {
    next(error);
  }
};

const getOrderById = async (req, res, next) => {
  try {
    const order = await queryOne('SELECT * FROM orders WHERE id = ?', [req.params.id]);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (order.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const fullOrder = await getOrderDetails(order.id);
    res.status(200).json({ success: true, order: fullOrder });
  } catch (error) {
    next(error);
  }
};

const getAllOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, payment } = req.query;
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (status) {
      whereClause += ' AND o.order_status = ?';
      params.push(status);
    }
    if (payment) {
      whereClause += ' AND o.payment_status = ?';
      params.push(payment);
    }

    const countResult = await query(`SELECT COUNT(*) as total FROM orders o ${whereClause}`, params);
    const total = countResult[0].total;
    const { limitInt, pageInt, offsetInt } = getPagination(page, limit, 20);

    const orders = await query(
      `SELECT o.*, u.name as customer_name, u.email as customer_email
       FROM orders o
       JOIN users u ON o.user_id = u.id
       ${whereClause}
       ORDER BY o.created_at DESC
       LIMIT ${limitInt} OFFSET ${offsetInt}`,
      params
    );

    const stats = await query(
      `SELECT
         COUNT(*) as total_orders,
         SUM(CASE WHEN order_status = 'Pending' THEN 1 ELSE 0 END) as pending,
         SUM(CASE WHEN order_status = 'Shipped' THEN 1 ELSE 0 END) as shipped,
         SUM(CASE WHEN order_status = 'Delivered' THEN 1 ELSE 0 END) as delivered,
         SUM(CASE WHEN order_status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled,
         SUM(CASE WHEN order_status != 'Cancelled' THEN total_price ELSE 0 END) as revenue
       FROM orders`
    );

    res.status(200).json({
      success: true,
      total,
      page: pageInt,
      pages: Math.ceil(total / limitInt),
      summary: stats[0],
      orders,
    });
  } catch (error) {
    next(error);
  }
};

const updateOrderStatus = async (req, res, next) => {
  try {
    const { orderStatus, paymentStatus, trackingNumber } = req.body;
    const order = await queryOne('SELECT id FROM orders WHERE id = ?', [req.params.id]);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const updates = [];
    const values = [];

    if (orderStatus) {
      if (!ORDER_STATUSES.has(orderStatus)) {
        return res.status(400).json({ success: false, message: 'Invalid order status.' });
      }
      updates.push('order_status = ?');
      values.push(orderStatus);
      if (orderStatus === 'Delivered') updates.push('delivered_at = NOW()');
    }

    if (paymentStatus) {
      if (!PAYMENT_STATUSES.has(paymentStatus)) {
        return res.status(400).json({ success: false, message: 'Invalid payment status.' });
      }
      updates.push('payment_status = ?');
      values.push(paymentStatus);
    }

    if (trackingNumber) {
      updates.push('tracking_number = ?');
      values.push(String(trackingNumber).trim());
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    values.push(req.params.id);
    await query(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`, values);
    const updated = await getOrderDetails(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Order updated successfully.',
      order: updated,
    });
  } catch (error) {
    next(error);
  }
};

const getOrderDetails = async (orderId) => {
  const order = await queryOne(
    `SELECT o.*, u.name as customer_name, u.email as customer_email
     FROM orders o
     LEFT JOIN users u ON o.user_id = u.id
     WHERE o.id = ?`,
    [orderId]
  );

  if (!order) return null;
  const items = await query('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
  return { ...order, items };
};

module.exports = {
  placeOrder,
  getMyOrders,
  getOrderById,
  getAllOrders,
  updateOrderStatus,
};

