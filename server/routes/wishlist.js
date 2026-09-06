const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Customer: list their wishlist with product details
router.get('/mine', authenticate, authorize('customer'), async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT w.id AS wishlist_id, w.product_id, w.created_at,
             p.name, p.sale_price, p.image_url, c.name AS category
      FROM wishlists w
      JOIN products p ON w.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE w.customer_id = ?
      ORDER BY w.created_at DESC
    `, [req.user.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch wishlist' });
  }
});

// Customer: add product to wishlist
router.post('/', authenticate, authorize('customer'), async (req, res) => {
  const { product_id } = req.body;
  try {
    if (!product_id) return res.status(400).json({ error: 'product_id is required' });
    const [existing] = await pool.query(
      'SELECT id FROM wishlists WHERE customer_id = ? AND product_id = ?',
      [req.user.id, product_id]
    );
    if (existing.length) return res.status(200).json({ message: 'Already in wishlist', id: existing[0].id });
    const [result] = await pool.query(
      'INSERT INTO wishlists (customer_id, product_id) VALUES (?, ?)',
      [req.user.id, product_id]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add to wishlist' });
  }
});

// Customer: remove from wishlist
router.delete('/:productId', authenticate, authorize('customer'), async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM wishlists WHERE customer_id = ? AND product_id = ?',
      [req.user.id, req.params.productId]
    );
    res.json({ message: 'Removed from wishlist' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove from wishlist' });
  }
});

module.exports = router;