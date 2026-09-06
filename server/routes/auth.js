const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/register',
  body('name').notEmpty(),
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('role').isIn(['customer', 'retailer', 'supplier', 'admin']),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, email, password, role, extra } = req.body;
    try {
      const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
      if (existing.length) return res.status(409).json({ error: 'Email already registered' });

      const hash = await bcrypt.hash(password, 10);
      const [result] = await pool.query(
        'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
        [name, email, hash, role]
      );
      const userId = result.insertId;

      if (role === 'retailer') {
        await pool.query('INSERT INTO retailers (user_id, store_name, location) VALUES (?, ?, ?)',
          [userId, extra?.store_name || `${name}'s Store`, extra?.location || '']);
      } else if (role === 'supplier') {
        await pool.query('INSERT INTO suppliers (user_id, company_name, contact_phone) VALUES (?, ?, ?)',
          [userId, extra?.company_name || `${name}'s Supply Co`, extra?.contact_phone || '']);
      }

      const token = jwt.sign({ id: userId, role, email }, process.env.JWT_SECRET, { expiresIn: '7d' });
      res.status(201).json({ token, user: { id: userId, name, email, role } });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

// Authenticated: resolve user's profile rows (retailer/supplier) + wishlist count
router.get('/me', authenticate, async (req, res) => {
  try {
    const [[user]] = await pool.query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!user) return res.status(404).json({ error: 'User not found' });

    let retailer = null;
    let supplier = null;
    if (user.role === 'retailer') {
      const [rows] = await pool.query('SELECT * FROM retailers WHERE user_id = ?', [user.id]);
      retailer = rows[0] || null;
    } else if (user.role === 'supplier') {
      const [rows] = await pool.query('SELECT * FROM suppliers WHERE user_id = ?', [user.id]);
      supplier = rows[0] || null;
    }

    const [[wishlistCount]] = await pool.query(
      'SELECT COUNT(*) AS count FROM wishlists WHERE customer_id = ?',
      [user.id]
    );

    res.json({ ...user, retailer, supplier, wishlist_count: wishlistCount.count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.post('/login',
  body('email').isEmail(),
  body('password').notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    try {
      const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
      if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

      const user = rows[0];
      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) return res.status(401).json({ error: 'Invalid credentials' });

      const token = jwt.sign(
        { id: user.id, role: user.role, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

module.exports = router;
