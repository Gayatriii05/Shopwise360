const express = require('express');
const { query } = require('express-validator');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { handleValidation } = require('../utils/validate');

const router = express.Router();

const validators = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
  query('action').optional().trim().isLength({ max: 50 }).withMessage('action is too long'),
  query('entity_type').optional().trim().isLength({ max: 50 }).withMessage('entity_type is too long'),
  query('entity_id').optional().isInt({ min: 1 }).withMessage('entity_id must be a positive integer'),
  handleValidation
];

// Admin only: paginated audit trail, newest first, with optional filters.
router.get('/', authenticate, authorize('admin'), validators, async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
  const offset = (page - 1) * limit;

  const where = [];
  const params = [];
  if (req.query.action) { where.push('a.action = ?'); params.push(req.query.action); }
  if (req.query.entity_type) { where.push('a.entity_type = ?'); params.push(req.query.entity_type); }
  if (req.query.entity_id) { where.push('a.entity_id = ?'); params.push(Number(req.query.entity_id)); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM audit_log a ${w}`, params);
    const [rows] = await pool.query(`
      SELECT a.id, a.actor_id, a.actor_role, a.action, a.entity_type, a.entity_id, a.details, a.created_at,
             u.name AS actor_name
      FROM audit_log a
      LEFT JOIN users u ON a.actor_id = u.id
      ${w}
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    res.json({
      items: rows.map((r) => ({
        ...r,
        details: typeof r.details === 'string' ? JSON.parse(r.details) : (r.details || {})
      })),
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

module.exports = router;