const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { body, param, query } = require('express-validator');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { handleValidation } = require('../utils/validate');
const { invalidateAllRetailers } = require('../services/dashboardCache');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Multer config: images only, 2MB cap, unique filename
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `product-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  }
});

// Public: list products with search/filter/sort/pagination + category + supplier joined
const listValidators = [
  query('search').optional().trim(),
  query('category_id').optional().isInt({ min: 1 }).withMessage('category_id must be a positive integer'),
  query('supplier_id').optional().isInt({ min: 1 }).withMessage('supplier_id must be a positive integer'),
  query('min_price').optional().toFloat().isFloat({ min: 0 }).withMessage('min_price must be >= 0'),
  query('max_price').optional().toFloat().isFloat({ min: 0 }).withMessage('max_price must be >= 0'),
  query('sort').optional().isIn(['newest', 'price_asc', 'price_desc', 'name_asc', 'rating']).withMessage('Invalid sort'),
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
  query('id').optional().isInt({ min: 1 }).withMessage('id must be a positive integer'),
  handleValidation
];
router.get('/', listValidators, async (req, res) => {
  try {
    const {
      search = '',
      category_id = '',
      min_price = '',
      max_price = '',
      sort = 'newest',
      page = 1,
      limit = 12,
      supplier_id = '',
      id = ''
    } = req.query;

    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit) || 12, 1), 100);
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    const params = [];

    if (id) {
      conditions.push('p.id = ?');
      params.push(id);
    }
    if (search) {
      conditions.push('(p.name LIKE ? OR p.description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    if (category_id) {
      conditions.push('p.category_id = ?');
      params.push(category_id);
    }
    if (supplier_id) {
      conditions.push('p.supplier_id = ?');
      params.push(supplier_id);
    }
    if (min_price !== '') {
      conditions.push('p.sale_price >= ?');
      params.push(Number(min_price));
    }
    if (max_price !== '') {
      conditions.push('p.sale_price <= ?');
      params.push(Number(max_price));
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const orderMap = {
      newest: 'p.created_at DESC',
      price_asc: 'p.sale_price ASC',
      price_desc: 'p.sale_price DESC',
      name_asc: 'p.name ASC',
      rating: '(SELECT AVG(r.rating) FROM reviews r WHERE r.product_id = p.id) DESC'
    };
    const orderClause = orderMap[sort] || orderMap.newest;

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM products p ${where}`,
      params
    );

    const [rows] = await pool.query(
      `SELECT p.id, p.name, p.description, p.cost_price, p.sale_price, p.image_url,
              p.created_at, c.id AS category_id, c.name AS category,
              s.id AS supplier_id, s.company_name AS supplier,
              COALESCE(avg_rating.avg_rating, 0) AS rating,
              COALESCE(avg_rating.review_count, 0) AS review_count
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       LEFT JOIN (SELECT product_id, AVG(rating) AS avg_rating, COUNT(*) AS review_count
                  FROM reviews GROUP BY product_id) avg_rating
         ON avg_rating.product_id = p.id
       ${where}
       ORDER BY ${orderClause}
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    res.json({
      products: rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: countRows[0].total,
        totalPages: Math.max(Math.ceil(countRows[0].total / limitNum), 1)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

router.get('/categories', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name FROM categories ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

router.get('/:id',
  param('id').isInt({ min: 1 }).withMessage('Invalid product id'),
  handleValidation,
  async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.*, c.name AS category, s.company_name AS supplier
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.id = ?
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Product not found' });
    const product = rows[0];

    const [[stats]] = await pool.query(`
      SELECT COALESCE(AVG(rating), 0) AS rating, COUNT(*) AS review_count
      FROM reviews WHERE product_id = ?
    `, [req.params.id]);

    const [reviews] = await pool.query(`
      SELECT r.id, r.rating, r.comment, r.created_at, u.name AS customer_name
      FROM reviews r JOIN users u ON r.customer_id = u.id
      WHERE r.product_id = ?
      ORDER BY r.created_at DESC
    `, [req.params.id]);

    res.json({ ...product, rating: Number(stats.rating), review_count: stats.review_count, reviews });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Supplier/Admin only: create product (optional image upload via multipart form)
const productBodyValidators = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 150 }).withMessage('Name is too long'),
  body('cost_price').toFloat().isFloat({ min: 0 }).withMessage('cost_price must be a number >= 0'),
  body('sale_price').toFloat().isFloat({ gt: 0 }).withMessage('sale_price must be > 0'),
  body('description').optional().trim(),
  body('category_id').optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage('category_id must be a positive integer'),
  body('supplier_id').optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage('supplier_id must be a positive integer'),
  handleValidation
];
router.post('/', authenticate, authorize('supplier', 'admin'), upload.single('image'), productBodyValidators, async (req, res) => {
  const { name, description, category_id, supplier_id, cost_price, sale_price } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : (req.body.image_url || '');
  try {
    const [result] = await pool.query(
      `INSERT INTO products (name, description, category_id, supplier_id, cost_price, sale_price, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, description, category_id || null, supplier_id || null, cost_price, sale_price, image_url]
    );
    await invalidateAllRetailers();
    res.status(201).json({ id: result.insertId, image_url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

router.put('/:id',
  authenticate, authorize('supplier', 'admin'), upload.single('image'),
  param('id').isInt({ min: 1 }).withMessage('Invalid product id'),
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('cost_price').toFloat().isFloat({ min: 0 }).withMessage('cost_price must be a number >= 0'),
  body('sale_price').toFloat().isFloat({ gt: 0 }).withMessage('sale_price must be > 0'),
  body('category_id').optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage('category_id must be a positive integer'),
  handleValidation,
  async (req, res) => {
  const { name, description, category_id, cost_price, sale_price } = req.body;
  let { image_url } = req.body;
  if (req.file) image_url = `/uploads/${req.file.filename}`;
  try {
    await pool.query(
      `UPDATE products SET name=?, description=?, category_id=?, cost_price=?, sale_price=?, image_url=? WHERE id=?`,
      [name, description, category_id || null, cost_price, sale_price, image_url || '', req.params.id]
    );
    await invalidateAllRetailers();
    res.json({ message: 'Product updated', image_url });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update product' });
  }
});

router.delete('/:id',
  authenticate, authorize('supplier', 'admin'),
  param('id').isInt({ min: 1 }).withMessage('Invalid product id'),
  handleValidation,
  async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
    await invalidateAllRetailers();
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// --- Reviews ---
// Public: reviews for a product
router.get('/:id/reviews',
  param('id').isInt({ min: 1 }).withMessage('Invalid product id'),
  handleValidation,
  async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT r.id, r.rating, r.comment, r.created_at, u.name AS customer_name
      FROM reviews r JOIN users u ON r.customer_id = u.id
      WHERE r.product_id = ?
      ORDER BY r.created_at DESC
    `, [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Customer: submit a review for a purchased product (must have a delivered/history order containing it)
router.post('/:id/reviews',
  authenticate, authorize('customer'),
  param('id').isInt({ min: 1 }).withMessage('Invalid product id'),
  body('rating').toInt().isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().trim(),
  handleValidation,
  async (req, res) => {
    const { rating, comment } = req.body;
    const productId = req.params.id;
    try {
    // Verify the customer actually ordered this product
    const [purchase] = await pool.query(`
      SELECT oi.order_id FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.customer_id = ? AND oi.product_id = ?
      LIMIT 1
    `, [req.user.id, productId]);
    if (!purchase.length) {
      return res.status(403).json({ error: 'You can only review products you have purchased' });
    }
    const [result] = await pool.query(
      'INSERT INTO reviews (customer_id, product_id, order_id, rating, comment) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, productId, purchase[0].order_id, rating, comment || '']
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'You have already reviewed this product for this purchase' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

module.exports = router;