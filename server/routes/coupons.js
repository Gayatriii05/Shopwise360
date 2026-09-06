const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

/**
 * Shared coupon validation + discount calculation.
 * Works with either the pool (read-only validation) or a transaction conn
 * (withForUpdate=true, so used_count/limits stay race-safe during checkout).
 */
async function resolveCoupon(query, code, retailerId, orderValue, withForUpdate = false) {
  const lock = withForUpdate ? ' FOR UPDATE' : '';
  const [rows] = await query('SELECT * FROM coupons WHERE code = ?' + lock, [code]);
  if (!rows.length) return { ok: false, reason: 'Unknown coupon code' };

  const c = rows[0];
  const now = new Date();
  if (!c.active) return { ok: false, reason: 'Coupon is inactive' };
  if (c.valid_from && new Date(c.valid_from) > now) return { ok: false, reason: 'Coupon is not yet valid' };
  if (c.valid_to && new Date(c.valid_to) < now) return { ok: false, reason: 'Coupon has expired' };
  if (c.retailer_id && Number(c.retailer_id) !== Number(retailerId)) {
    return { ok: false, reason: 'Coupon is not valid for this store' };
  }
  if (Number(c.min_order_value) > 0 && Number(orderValue) < Number(c.min_order_value)) {
    return { ok: false, reason: `Minimum order value of ₹${Number(c.min_order_value).toFixed(2)} not met` };
  }
  if (c.usage_limit !== null && c.usage_limit !== undefined && Number(c.used_count) >= Number(c.usage_limit)) {
    return { ok: false, reason: 'Coupon usage limit has been reached' };
  }

  let discount = c.discount_type === 'percent'
    ? (Number(orderValue) * Number(c.discount_value)) / 100
    : Number(c.discount_value);
  if (c.max_discount !== null && c.max_discount !== undefined && discount > Number(c.max_discount)) {
    discount = Number(c.max_discount);
  }
  discount = Math.min(discount, Number(orderValue)); // never discount more than the order
  discount = Math.round(discount * 100) / 100;

  return { ok: true, coupon: c, discount };
}

// ---- Admin: coupon management ----

router.post('/', authenticate, authorize('admin'), async (req, res) => {
  const {
    code, description, discount_type, discount_value, min_order_value = 0,
    max_discount = null, active = true, valid_from = null, valid_to = null,
    usage_limit = null, retailer_id = null
  } = req.body || {};
  if (!code || !['percent', 'flat'].includes(discount_type) || !(Number(discount_value) > 0)) {
    return res.status(400).json({ error: 'code, discount_type (percent|flat) and discount_value > 0 are required' });
  }
  try {
    const [result] = await pool.query(
      `INSERT INTO coupons (code, description, discount_type, discount_value, min_order_value,
        max_discount, active, valid_from, valid_to, usage_limit, retailer_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [code.toUpperCase(), description || null, discount_type, discount_value,
       min_order_value, max_discount, active, valid_from, valid_to, usage_limit, retailer_id]
    );
    res.status(201).json({ id: result.insertId, code: code.toUpperCase() });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Coupon code already exists' });
    console.error(err);
    res.status(500).json({ error: 'Failed to create coupon' });
  }
});

router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.*, r.store_name AS retailer_name
      FROM coupons c
      LEFT JOIN retailers r ON c.retailer_id = r.id
      ORDER BY c.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch coupons' });
  }
});

router.get('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM coupons WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Coupon not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch coupon' });
  }
});

router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  const allowed = ['code', 'description', 'discount_type', 'discount_value', 'min_order_value',
    'max_discount', 'active', 'valid_from', 'valid_to', 'usage_limit', 'retailer_id'];
  const sets = [];
  const params = [];
  for (const key of allowed) {
    if (key in (req.body || {})) {
      sets.push(`${key} = ?`);
      params.push(req.body[key] === '' ? null : req.body[key]);
    }
  }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
  params.push(req.params.id);
  try {
    await pool.query(`UPDATE coupons SET ${sets.join(', ')} WHERE id = ?`, params);
    res.json({ message: 'Coupon updated' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Coupon code already exists' });
    res.status(500).json({ error: 'Failed to update coupon' });
  }
});

router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM coupons WHERE id = ?', [req.params.id]);
    res.json({ message: 'Coupon deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete coupon' });
  }
});

// ---- Customer: validate a code against a prospective order ----
router.post('/validate', authenticate, authorize('customer'), async (req, res) => {
  const { code, order_value, retailer_id } = req.body || {};
  if (!code || !order_value || !retailer_id) {
    return res.status(400).json({ error: 'code, order_value and retailer_id are required' });
  }
  const result = await resolveCoupon((q, p) => pool.query(q, p), code, retailer_id, order_value);
  if (!result.ok) {
    return res.status(400).json({ valid: false, reason: result.reason });
  }
  res.json({
    valid: true,
    coupon_id: result.coupon.id,
    code: result.coupon.code,
    discount: result.discount,
    discount_type: result.coupon.discount_type,
    discount_value: result.coupon.discount_value
  });
});

module.exports = { router, resolveCoupon };