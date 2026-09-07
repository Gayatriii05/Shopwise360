const express = require('express');
const axios = require('axios');
const { body, param } = require('express-validator');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { handleValidation } = require('../utils/validate');

const router = express.Router();
const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:6000';

const idParam = (name, message = 'Invalid id') => param(name).isInt({ min: 1 }).withMessage(message);

// Get product recommendations for a customer (calls Python ML microservice).
// Audit rows are written ONLY when the underlying model was actually (re)computed
// (X-ML-Computed: true), not on every read/cache hit — keeps the log lean.
router.get('/recommend/:customerId',
  authenticate,
  idParam('customerId', 'Invalid customer id'),
  handleValidation,
  async (req, res) => {
  try {
    const response = await axios.get(`${ML_URL}/recommend`, {
      params: { customer_id: req.params.customerId }
    });
    const recs = response.data || [];
    const computed = String(response.headers['x-ml-computed']).toLowerCase() === 'true';
    res.setHeader('X-ML-Computed', computed ? 'true' : 'false');

    if (computed) {
      for (const r of recs) {
        await pool.query(
          'INSERT INTO recommendations_log (customer_id, product_id, score) VALUES (?, ?, ?)',
          [req.params.customerId, r.product_id, r.score]
        ).catch(() => {}); // non-blocking
      }
    }

    res.json(recs);
  } catch (err) {
    console.error('ML recommend error:', err.message);
    res.status(502).json({ error: 'Recommendation service unavailable' });
  }
});

// Get demand prediction for a retailer's products.
// demand_predictions rows are upserted (unique per retailer+product+day) and written
// ONLY when the model was actually (re)computed — cache hits write nothing, so the
// table is bounded at one row per product per day instead of growing per dashboard load.
router.get('/predict-demand/:retailerId',
  authenticate,
  idParam('retailerId', 'Invalid retailer id'),
  handleValidation,
  async (req, res) => {
  try {
    const response = await axios.get(`${ML_URL}/predict-demand`, {
      params: { retailer_id: req.params.retailerId }
    });
    const predictions = response.data || [];
    const computed = String(response.headers['x-ml-computed']).toLowerCase() === 'true';
    res.setHeader('X-ML-Computed', computed ? 'true' : 'false');

    if (computed) {
      for (const p of predictions) {
        await pool.query(
          `INSERT INTO demand_predictions (product_id, retailer_id, predicted_demand, prediction_date)
           VALUES (?, ?, ?, CURDATE())
           ON DUPLICATE KEY UPDATE predicted_demand = VALUES(predicted_demand)`,
          [p.product_id, req.params.retailerId, p.predicted_demand]
        ).catch(() => {});
      }
    }

    res.json(predictions);
  } catch (err) {
    console.error('ML predict error:', err.message);
    res.status(502).json({ error: 'Demand prediction service unavailable' });
  }
});

// Admin: persisted model registry + evaluation metrics (MAE, precision@k)
router.get('/model-health', authenticate, authorize('admin'), async (req, res) => {
  try {
    const response = await axios.get(`${ML_URL}/model-health`);
    res.json(response.data);
  } catch (err) {
    console.error('ML model-health error:', err.message);
    res.status(502).json({ error: 'Model health endpoint unavailable' });
  }
});

// Admin: force (re)build of persisted models
router.post('/retrain',
  authenticate, authorize('admin'),
  body('target').optional().isIn(['recommend', 'demand', 'all']).withMessage('target must be recommend, demand or all'),
  body('retailer_id').optional().isInt({ min: 1 }).withMessage('retailer_id must be a positive integer'),
  handleValidation,
  async (req, res) => {
    const { target, retailer_id } = req.body || {};
  try {
    const response = await axios.post(`${ML_URL}/retrain`, { target, retailer_id });
    res.json(response.data);
  } catch (err) {
    console.error('ML retrain error:', err.message);
    res.status(502).json({ error: 'Retrain failed: Model service unavailable' });
  }
});

module.exports = router;