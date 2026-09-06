const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { emitLowStockAlert } = require('../socket');

const router = express.Router();

// Retailer's own inventory with product info (multi-table join)
router.get('/retailer/:retailerId', authenticate, authorize('retailer', 'admin'), async (req, res) => {
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
router.get('/retailer/:retailerId/low-stock', authenticate, authorize('retailer', 'admin'), async (req, res) => {
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

router.put('/:id', authenticate, authorize('retailer', 'admin'), async (req, res) => {
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
        }
      } catch (_e) {}
    }
    res.json({ message: 'Inventory updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update inventory' });
  }
});

router.post('/', authenticate, authorize('retailer', 'admin'), async (req, res) => {
  const { product_id, retailer_id, quantity, low_stock_threshold } = req.body;
  try {
    const [result] = await pool.query(
      'INSERT INTO inventory (product_id, retailer_id, quantity, low_stock_threshold) VALUES (?, ?, ?, ?)',
      [product_id, retailer_id, quantity, low_stock_threshold || 10]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add inventory record' });
  }
});

module.exports = router;
