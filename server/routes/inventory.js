const express = require('express');
const { body, param } = require('express-validator');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { emitLowStockAlert } = require('../socket');
const { handleValidation } = require('../utils/validate');
const { invalidateRetailer } = require('../services/dashboardCache');
const { sendLowStockAlert, dispatch } = require('../services/mailer');

const router = express.Router();

const idParam = (name = 'retailerId') => param(name).isInt({ min: 1 }).withMessage('Invalid id');

// Retailer's own inventory with product info (multi-table join)
router.get('/retailer/:retailerId',
  authenticate, authorize('retailer', 'admin'),
  idParam(),
  handleValidation,
  async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT i.id, i.quantity, i.low_stock_threshold, i.updated_at,
             p.id AS product_id, p.name, p.sale_price, p.cost_price,
             c.name AS category
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE i.retailer_id = ?
      ORDER BY i.quantity ASC
    `, [req.params.retailerId]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// Low stock alerts (quantity <= threshold)
router.get('/retailer/:retailerId/low-stock',
  authenticate, authorize('retailer', 'admin'),
  idParam(),
  handleValidation,
  async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT i.id AS inventory_id, p.name, i.quantity, i.low_stock_threshold
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      WHERE i.retailer_id = ? AND i.quantity <= i.low_stock_threshold
    `, [req.params.retailerId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch low stock items' });
  }
});

router.put('/:id',
  authenticate, authorize('retailer', 'admin'),
  param('id').isInt({ min: 1 }).withMessage('Invalid inventory id'),
  body('quantity').toInt().isInt({ min: 0 }).withMessage('quantity must be an integer >= 0'),
  body('low_stock_threshold').toInt().isInt({ min: 0 }).withMessage('low_stock_threshold must be an integer >= 0'),
  handleValidation,
  async (req, res) => {
    const { quantity, low_stock_threshold } = req.body;
  try {
    await pool.query(
      'UPDATE inventory SET quantity = ?, low_stock_threshold = ? WHERE id = ?',
      [quantity, low_stock_threshold, req.params.id]
    );

    // Auto-create alert if below threshold + push real-time
    if (quantity <= low_stock_threshold) {
      const [ins] = await pool.query(
        'INSERT INTO stock_alerts (inventory_id, message) VALUES (?, ?)',
        [req.params.id, `Stock low: quantity ${quantity} at or below threshold ${low_stock_threshold}`]
      );
      try {
        const [[inv]] = await pool.query(
          'SELECT retailer_id FROM inventory WHERE id = ?', [req.params.id]
        );
        if (inv) {
          emitLowStockAlert(inv.retailer_id, {
            inventory_id: req.params.id, alert_id: ins.insertId, quantity, threshold: low_stock_threshold, message: 'Stock low'
          });
          // Best-effort email: low-stock alert to the retailer
          dispatch((async () => {
            const [[retailer]] = await pool.query(`
              SELECT r.store_name, u.email
              FROM retailers r JOIN users u ON r.user_id = u.id
              WHERE r.id = ?`, [inv.retailer_id]);
            if (!retailer) return null;
            const [[prod]] = await pool.query('SELECT name FROM products WHERE id = (SELECT product_id FROM inventory WHERE id = ?)', [req.params.id]);
            return sendLowStockAlert({
              to: retailer.email,
              storeName: retailer.store_name,
              productName: prod ? prod.name : `Inventory #${req.params.id}`,
              quantity,
              threshold: low_stock_threshold
            });
          })());
        }
      } catch (_e) {}
    }
    const [[row]] = await pool.query('SELECT retailer_id FROM inventory WHERE id = ?', [req.params.id]);
    if (row) await invalidateRetailer(row.retailer_id);
    res.json({ message: 'Inventory updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update inventory' });
  }
});

router.post('/',
  authenticate, authorize('retailer', 'admin'),
  body('product_id').isInt({ min: 1 }).withMessage('product_id must be a positive integer'),
  body('retailer_id').isInt({ min: 1 }).withMessage('retailer_id must be a positive integer'),
  body('quantity').toInt().isInt({ min: 0 }).withMessage('quantity must be an integer >= 0'),
  body('low_stock_threshold').optional().toInt().isInt({ min: 0 }).withMessage('low_stock_threshold must be an integer >= 0'),
  handleValidation,
  async (req, res) => {
    const { product_id, retailer_id, quantity, low_stock_threshold } = req.body;
  try {
    const [result] = await pool.query(
      'INSERT INTO inventory (product_id, retailer_id, quantity, low_stock_threshold) VALUES (?, ?, ?, ?)',
      [product_id, retailer_id, quantity, low_stock_threshold || 10]
    );
    await invalidateRetailer(retailer_id);
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add inventory record' });
  }
});

module.exports = router;
