const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Retailer dashboard: revenue, profit, top products, category breakdown
router.get('/retailer/:retailerId/summary', authenticate, authorize('retailer', 'admin'), async (req, res) => {
  try {
    const retailerId = req.params.retailerId;

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

    res.json({ totals, topProducts, categoryBreakdown, dailySales, lowStock });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to build retailer dashboard' });
  }
});

// Admin dashboard: platform-wide aggregates across all retailers
router.get('/admin/summary', authenticate, authorize('admin'), async (req, res) => {
  try {
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

    res.json({ totals, byRetailer, userCounts, topProductsPlatform });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to build admin dashboard' });
  }
});

// Supplier dashboard: which of their products are selling
router.get('/supplier/:supplierId/summary', authenticate, authorize('supplier', 'admin'), async (req, res) => {
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
