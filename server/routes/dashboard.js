const express = require('express');
const { param } = require('express-validator');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { handleValidation } = require('../utils/validate');
const { loadRetailer, loadAdmin } = require('../services/dashboardCache');

const router = express.Router();

const idParam = (name) => param(name).isInt({ min: 1 }).withMessage('Invalid id');

// Retailer dashboard: revenue, profit, top products, category breakdown.
// Cached (fail-open) — Redis unreachable falls back to a direct DB query.
router.get('/retailer/:retailerId/summary',
  authenticate, authorize('retailer', 'admin'),
  idParam('retailerId'),
  handleValidation,
  async (req, res) => {
  try {
    const retailerId = req.params.retailerId;
    const { value, cached } = await loadRetailer(retailerId, async () => {
      const [[totals]] = await pool.query(`
        SELECT COALESCE(SUM(revenue),0) AS total_revenue,
               COALESCE(SUM(profit),0) AS total_profit,
               COUNT(DISTINCT order_id) AS total_orders
        FROM sales_transactions WHERE retailer_id = ?
      `, [retailerId]);

      const [topProducts] = await pool.query(`
        SELECT p.name, SUM(st.quantity) AS units_sold, SUM(st.revenue) AS revenue
        FROM sales_transactions st
        JOIN products p ON st.product_id = p.id
        WHERE st.retailer_id = ?
        GROUP BY p.id, p.name
        ORDER BY units_sold DESC
        LIMIT 5
      `, [retailerId]);

      const [categoryBreakdown] = await pool.query(`
        SELECT c.name AS category, SUM(st.revenue) AS revenue
        FROM sales_transactions st
        JOIN products p ON st.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE st.retailer_id = ?
        GROUP BY c.name
      `, [retailerId]);

      const [dailySales] = await pool.query(`
        SELECT DATE(sold_at) AS date, SUM(revenue) AS revenue, SUM(profit) AS profit
        FROM sales_transactions
        WHERE retailer_id = ? AND sold_at >= NOW() - INTERVAL 30 DAY
        GROUP BY DATE(sold_at)
        ORDER BY date ASC
      `, [retailerId]);

      const [lowStock] = await pool.query(`
        SELECT p.name, i.quantity, i.low_stock_threshold
        FROM inventory i JOIN products p ON i.product_id = p.id
        WHERE i.retailer_id = ? AND i.quantity <= i.low_stock_threshold
      `, [retailerId]);

      return { totals, topProducts, categoryBreakdown, dailySales, lowStock };
    });

    res.setHeader('X-Cache', cached ? 'HIT' : 'MISS');
    res.json(value);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to build retailer dashboard' });
  }
});

// Admin dashboard: platform-wide aggregates across all retailers (cached, fail-open)
router.get('/admin/summary', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { value, cached } = await loadAdmin(async () => {
      const [[totals]] = await pool.query(`
        SELECT COALESCE(SUM(revenue),0) AS platform_revenue,
               COALESCE(SUM(profit),0) AS platform_profit,
               COUNT(DISTINCT order_id) AS total_orders
        FROM sales_transactions
      `);

      const [byRetailer] = await pool.query(`
        SELECT r.store_name, SUM(st.revenue) AS revenue, SUM(st.profit) AS profit
        FROM sales_transactions st
        JOIN retailers r ON st.retailer_id = r.id
        GROUP BY r.id, r.store_name
        ORDER BY revenue DESC
      `);

      const [userCounts] = await pool.query(`
        SELECT role, COUNT(*) AS count FROM users GROUP BY role
      `);

      const [topProductsPlatform] = await pool.query(`
        SELECT p.name, SUM(st.quantity) AS units_sold, SUM(st.revenue) AS revenue
        FROM sales_transactions st
        JOIN products p ON st.product_id = p.id
        GROUP BY p.id, p.name
        ORDER BY revenue DESC
        LIMIT 10
      `);

      return { totals, byRetailer, userCounts, topProductsPlatform };
    });

    res.setHeader('X-Cache', cached ? 'HIT' : 'MISS');
    res.json(value);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to build admin dashboard' });
  }
});

// Supplier dashboard: which of their products are selling
router.get('/supplier/:supplierId/summary',
  authenticate, authorize('supplier', 'admin'),
  idParam('supplierId'),
  handleValidation,
  async (req, res) => {
  try {
    const [productPerformance] = await pool.query(`
      SELECT p.name, COALESCE(SUM(st.quantity),0) AS units_sold, COALESCE(SUM(st.revenue),0) AS revenue
      FROM products p
      LEFT JOIN sales_transactions st ON st.product_id = p.id
      WHERE p.supplier_id = ?
      GROUP BY p.id, p.name
      ORDER BY revenue DESC
    `, [req.params.supplierId]);

    const [stockAcrossRetailers] = await pool.query(`
      SELECT p.name, r.store_name, i.quantity
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      JOIN retailers r ON i.retailer_id = r.id
      WHERE p.supplier_id = ?
    `, [req.params.supplierId]);

    res.json({ productPerformance, stockAcrossRetailers });
  } catch (err) {
    res.status(500).json({ error: 'Failed to build supplier dashboard' });
  }
});

module.exports = router;
