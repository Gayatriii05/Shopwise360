const express = require('express');
const bcrypt = require('bcryptjs');
const { body } = require('express-validator');
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { authLimiter, registerLimiter } = require('../middleware/rateLimiter');
const { handleValidation } = require('../utils/validate');
const { signAccessToken, issueRefreshToken, rotateRefreshToken, revokeRefreshToken } = require('../services/tokenStore');

const router = express.Router();

router.post('/register',
  registerLimiter,
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }).withMessage('Name is too long'),
  body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['customer', 'retailer', 'supplier', 'admin']).withMessage('Invalid role'),
  body('extra').optional().isObject().withMessage('extra must be an object'),
  handleValidation,
  async (req, res) => {
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

      const accessToken = signAccessToken({ id: userId, role, email });
      const refreshToken = await issueRefreshToken(userId);
      res.status(201).json({
        token: accessToken,
        accessToken,
        refreshToken,
        user: { id: userId, name, email, role }
      });
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
  authLimiter,
  body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidation,
  async (req, res) => {
    const { email, password } = req.body;
    try {
      const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
      if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

      const user = rows[0];
      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) return res.status(401).json({ error: 'Invalid credentials' });

      const accessToken = signAccessToken(user);
      const refreshToken = await issueRefreshToken(user.id);
      res.json({
        token: accessToken,
        accessToken,
        refreshToken,
        user: { id: user.id, name: user.name, email: user.email, role: user.role }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

router.post('/logout',
  body('refreshToken').optional().notEmpty().withMessage('refreshToken must not be empty'),
  handleValidation,
  async (req, res) => {
    try {
      await revokeRefreshToken(req.body?.refreshToken);
      res.json({ message: 'Logged out' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Logout failed' });
    }
  }
);

// Rotate a refresh token → new access + refresh pair (opaque, stored hashed).
// Unknown/revoked/expired tokens trigger reuse detection and revoke ALL of the
// user's refresh tokens.
router.post('/refresh',
  body('refreshToken').notEmpty().withMessage('refreshToken is required'),
  handleValidation,
  async (req, res) => {
    const { refreshToken } = req.body;
    try {
      const result = await rotateRefreshToken(refreshToken);
      if (!result) return res.status(401).json({ error: 'Invalid refresh token' });
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Refresh failed' });
    }
  }
);

module.exports = router;
