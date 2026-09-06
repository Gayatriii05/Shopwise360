const express = require('express');
const pool = require('../config/db');

const router = express.Router();

// Public: list retailers (stores) for ordering
router.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT r.id, r.store_name, r.location
      FROM retailers r
      ORDER BY r.store_name
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch retailers' });
  }
});

module.exports = router;