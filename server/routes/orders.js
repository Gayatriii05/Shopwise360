const express = require('express');
const { body, param } = require('express-validator');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { emitNewOrder, emitOrderStatusChange, emitLowStockAlert, emitDashboardUpdate } = require('../socket');
const { resolveCoupon } = require('./coupons');
const { handleValidation } = require('../utils/validate');
const { invalidateRetailer } = require('../services/dashboardCache');
const { sendOrderConfirmation, sendOrderStatusChange, dispatch } = require('../services/mailer');
const { recordAudit } = require('../services/auditLogger');

const router = express.Router();

const VALID_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
const STATUS_FLOW = ['pending', 'confirmed', 'shipped', 'delivered'];

// Customer places an order (with items array, optional coupon_code)
router.post('/',
  authenticate, authorize('customer'),
  body('retailer_id').isInt({ min: 1 }).withMessage('retailer_id must be a positive integer'),
  body('items').isArray({ min: 1 }).withMessage('items must be a non-empty array'),
  body('items.*.product_id').isInt({ min: 1 }).withMessage('Each item needs a valid product_id'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Each item needs quantity >= 1'),
  body('coupon_code').optional().trim().isString(),
  handleValidation,
  async (req, res) => {
    const { retailer_id, items } = req.body; // items: [{ product_id, quantity }]
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      let total = 0;
      const priced = [];
      for (const item of items) {
        const qty = Number(item.quantity);
        const [[product]] = await conn.query('SELECT sale_price, cost_price FROM products WHERE id = ?', [item.product_id]);
        if (!product) {
          const nf = new Error(`Product ${item.product_id} not found`);
          nf.statusCode = 400;
          throw nf;
        }

        // Check inventory availability
        const [[inv]] = await conn.query(
          'SELECT quantity FROM inventory WHERE product_id = ? AND retailer_id = ?',
          [item.product_id, retailer_id]
        );
        if (!inv || inv.quantity < qty) {
          const err = new Error(`Insufficient stock for product ${item.product_id}`);
          err.statusCode = 409;
          throw err;
        }

      const lineTotal = Number(product.sale_price) * qty;
      total += lineTotal;
      priced.push({ ...item, quantity: qty, unit_price: Number(product.sale_price), cost_price: Number(product.cost_price), lineTotal });
    }

    // Optional coupon: validate inside the transaction (row lock) and compute discount
    let couponId = null;
    let discount = 0;
    if (req.body.coupon_code) {
      const result = await resolveCoupon((q, p) => conn.query(q, p), req.body.coupon_code, retailer_id, total, true);
      if (!result.ok) {
        const err = new Error(result.reason);
        err.statusCode = 400;
        throw err;
      }
      couponId = result.coupon.id;
      discount = result.discount;
    }

    // Allocate the discount proportionally across line items (last line absorbs rounding)
    let remaining = discount;
    const adjusted = priced.map((item, idx) => {
      const isLast = idx === priced.length - 1;
      const alloc = isLast
        ? remaining
        : Math.round(discount * (item.lineTotal / total) * 100) / 100;
      remaining = Math.max(0, Math.round((remaining - alloc) * 100) / 100);
      const revenue = Math.max(0, Math.round((item.lineTotal - alloc) * 100) / 100);
      const profit = Math.round((revenue - item.cost_price * item.quantity) * 100) / 100;
      return { ...item, revenue, profit };
    });

    const finalTotal = Math.max(0, Math.round((total - discount) * 100) / 100);

    const [orderResult] = await conn.query(
      'INSERT INTO orders (customer_id, retailer_id, status, total_amount, coupon_id, discount_amount) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, retailer_id, 'pending', finalTotal, couponId, discount]
    );
    const orderId = orderResult.insertId;

    for (const item of adjusted) {
      await conn.query(
        'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
        [orderId, item.product_id, item.quantity, item.unit_price]
      );

      // Decrement inventory (guarded UPDATE to avoid overselling)
      const [invUpdate] = await conn.query(
        'UPDATE inventory SET quantity = quantity - ? WHERE product_id = ? AND retailer_id = ? AND quantity >= ?',
        [item.quantity, item.product_id, retailer_id, item.quantity]
      );
      if (invUpdate.affectedRows === 0) {
        const err = new Error(`Insufficient stock for product ${item.product_id}`);
        err.statusCode = 409;
        throw err;
      }

      // Record sale + profit (revenue already reflects any coupon allocation)
      await conn.query(
        'INSERT INTO sales_transactions (order_id, product_id, retailer_id, quantity, revenue, profit) VALUES (?, ?, ?, ?, ?, ?)',
        [orderId, item.product_id, retailer_id, item.quantity, item.revenue, item.profit]
      );
    }

    if (couponId) {
      await conn.query('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?', [couponId]);
    }

    await conn.commit();

    // Emit real-time events (best-effort, non-blocking)
    try {
      emitNewOrder(retailer_id, { id: orderId, total: finalTotal, customer_id: req.user.id, items: adjusted.map(i => ({ product_id: i.product_id, quantity: i.quantity })) });
      // Check if any of the ordered products' inventory dropped below threshold
      for (const item of adjusted) {
        const [[inv]] = await pool.query(
          'SELECT quantity, low_stock_threshold FROM inventory WHERE product_id = ? AND retailer_id = ?',
          [item.product_id, retailer_id]
        );
        if (inv && inv.quantity <= inv.low_stock_threshold) {
          emitLowStockAlert(retailer_id, { product_id: item.product_id, quantity: inv.quantity, threshold: inv.low_stock_threshold });
        }
      }
    } catch (_e) { /* socket is best-effort */ }

    // Best-effort email notification: order confirmation to the customer.
    // Fire-and-forget — a slow/down mail relay must never affect the response.
    try {
      dispatch((async () => {
        const [[customer]] = await pool.query('SELECT name, email FROM users WHERE id = ?', [req.user.id]);
        const [[retailer]] = await pool.query('SELECT store_name FROM retailers WHERE id = ?', [retailer_id]);
        const [orderLines] = await pool.query(
          `SELECT p.name, oi.quantity, oi.unit_price AS price
           FROM order_items oi JOIN products p ON oi.product_id = p.id
           WHERE oi.order_id = ?`, [orderId]
        );
        return sendOrderConfirmation({
          to: customer.email,
          customerName: customer.name,
          orderId,
          total: finalTotal,
          retailerName: retailer.store_name,
          items: orderLines
        });
      })());
    } catch (_e) { /* email is best-effort */ }

    await invalidateRetailer(retailer_id);
    res.status(201).json({ orderId, total: finalTotal, discount });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Order failed' });
  } finally {
    conn.release();
  }
});

// Customer: order history with items + current status
router.get('/customer/:customerId',
  authenticate,
  param('customerId').isInt({ min: 1 }).withMessage('Invalid customer id'),
  handleValidation,
  async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT o.id, o.status, o.total_amount, o.created_at, o.retailer_id,
             r.store_name AS retailer
      FROM orders o
      JOIN retailers r ON o.retailer_id = r.id
      WHERE o.customer_id = ?
      ORDER BY o.created_at DESC
    `, [req.params.customerId]);

    // Attach line items to each order
    for (const order of rows) {
      const [items] = await pool.query(`
        SELECT oi.product_id, oi.quantity, oi.unit_price, p.name, p.image_url
        FROM order_items oi JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
      `, [order.id]);
      order.items = items;
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Retailer/Admin: orders for a retailer with customer info + items
router.get('/retailer/:retailerId',
  authenticate, authorize('retailer', 'admin'),
  param('retailerId').isInt({ min: 1 }).withMessage('Invalid retailer id'),
  handleValidation,
  async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT o.id, o.status, o.total_amount, o.created_at, o.customer_id,
             u.name AS customer_name, u.email AS customer_email
      FROM orders o
      JOIN users u ON o.customer_id = u.id
      WHERE o.retailer_id = ?
      ORDER BY
        CASE o.status WHEN 'pending' THEN 0 WHEN 'confirmed' THEN 1 WHEN 'shipped' THEN 2 WHEN 'delivered' THEN 3 ELSE 4 END,
        o.created_at DESC
    `, [req.params.retailerId]);

    for (const order of rows) {
      const [items] = await pool.query(`
        SELECT oi.product_id, oi.quantity, oi.unit_price, p.name, p.image_url
        FROM order_items oi JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
      `, [order.id]);
      order.items = items;
    }
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Retailer/Admin: advance order status (enforces pending -> confirmed -> shipped -> delivered)
router.put('/:id/status',
  authenticate, authorize('retailer', 'admin'),
  param('id').isInt({ min: 1 }).withMessage('Invalid order id'),
  body('status').isIn(VALID_STATUSES).withMessage(`Status must be one of: ${VALID_STATUSES.join(', ')}`),
  handleValidation,
  async (req, res) => {
    const { status } = req.body;
    try {
      const [rows] = await pool.query('SELECT status FROM orders WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Order not found' });
    const current = rows[0].status;

    if (current !== 'cancelled' && STATUS_FLOW.includes(current) && status !== 'cancelled') {
      const nextIdx = STATUS_FLOW.indexOf(current);
      if (!STATUS_FLOW.includes(status) || STATUS_FLOW.indexOf(status) !== nextIdx + 1) {
        return res.status(400).json({ error: `Cannot move from '${current}' directly to '${status}'` });
      }
    }

    await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
    recordAudit(req, 'order.status', 'order', req.params.id, { oldStatus: current, newStatus: status });
    // Emit real-time status change
    try {
      const [orderRows] = await pool.query('SELECT customer_id, retailer_id FROM orders WHERE id = ?', [req.params.id]);
      if (orderRows.length) {
        const ord = orderRows[0];
        emitOrderStatusChange(ord.customer_id, ord.retailer_id, req.params.id, status);
        emitDashboardUpdate(ord.retailer_id); // refresh retailer dashboard numbers
        await invalidateRetailer(ord.retailer_id);

        // Best-effort email: status change notification to the customer
        dispatch((async () => {
          const [[customer]] = await pool.query('SELECT name, email FROM users WHERE id = ?', [ord.customer_id]);
          if (!customer) return null;
          return sendOrderStatusChange({
            to: customer.email,
            customerName: customer.name,
            orderId: req.params.id,
            newStatus: status,
            oldStatus: current
          });
        })());
      }
    } catch (_e) {}
    res.json({ message: 'Order status updated', status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

module.exports = router;