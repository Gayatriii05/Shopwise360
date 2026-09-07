const express = require('express');
const { query } = require('express-validator');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { handleValidation } = require('../utils/validate');
const PDFDocument = require('pdfkit');

const router = express.Router();

const DATE = () => new Date().toISOString().slice(0, 10);

function csvEscape(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCSV(headers, rows) {
  const lines = [headers.map((h) => csvEscape(h.label)).join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h.key])).join(','));
  }
  return lines.join('\n');
}

// ---- shared row queries ----

function salesQuery(retailerId) {
  const where = retailerId ? 'WHERE st.retailer_id = ?' : '';
  const params = retailerId ? [retailerId] : [];
  const sql = `
    SELECT DATE_FORMAT(st.sold_at, '%Y-%m-%d %H:%i') AS date,
           st.order_id, r.store_name AS retailer, p.name AS product,
           st.quantity, st.revenue, st.profit
    FROM sales_transactions st
    JOIN products p ON st.product_id = p.id
    JOIN retailers r ON st.retailer_id = r.id
    ${where}
    ORDER BY st.sold_at DESC`;
  return { sql, params };
}

function inventoryQuery(retailerId) {
  const where = retailerId ? 'WHERE i.retailer_id = ?' : '';
  const params = retailerId ? [retailerId] : [];
  const sql = `
    SELECT r.store_name AS retailer, p.name AS product,
           COALESCE(c.name, '—') AS category,
           i.quantity, i.low_stock_threshold,
           CASE WHEN i.quantity <= i.low_stock_threshold THEN 'LOW' ELSE 'OK' END AS stock_status
    FROM inventory i
    JOIN products p ON i.product_id = p.id
    JOIN retailers r ON i.retailer_id = r.id
    LEFT JOIN categories c ON p.category_id = c.id
    ${where}
    ORDER BY r.store_name, p.name`;
  return { sql, params };
}

// ---- request scope helper: retailers are locked to their own store; admin may pass ?retailer_id ----
async function resolveScope(req) {
  if (req.user.role === 'retailer') {
    const [[profile]] = await pool.query('SELECT id FROM retailers WHERE user_id = ?', [req.user.id]);
    if (!profile) {
      const err = new Error('No retailer profile linked');
      err.statusCode = 403;
      throw err;
    }
    return profile.id;
  }
  return req.query.retailer_id ? Number(req.query.retailer_id) : null;
}

function handleError(res, err, fallback) {
  console.error(err);
  res.status(err.statusCode || 500).json({ error: err.message || fallback });
}

const retailerScope = query('retailer_id').optional().isInt({ min: 1 }).withMessage('retailer_id must be a positive integer');

// ---- CSV exports ----
router.get('/sales/csv', authenticate, authorize('retailer', 'admin'), retailerScope, handleValidation, async (req, res) => {
  try {
    const retailerId = await resolveScope(req);
    const { sql, params } = salesQuery(retailerId);
    const [rows] = await pool.query(sql, params);
    const csv = toCSV(
      [
        { key: 'date', label: 'Date' },
        { key: 'order_id', label: 'Order ID' },
        { key: 'retailer', label: 'Retailer' },
        { key: 'product', label: 'Product' },
        { key: 'quantity', label: 'Quantity' },
        { key: 'revenue', label: 'Revenue' },
        { key: 'profit', label: 'Profit' }
      ],
      rows.map((r) => ({ ...r, revenue: Number(r.revenue).toFixed(2), profit: Number(r.profit).toFixed(2) }))
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=sales-report-${DATE()}.csv`);
    res.send(csv);
  } catch (err) {
    handleError(res, err, 'Failed to export sales CSV');
  }
});

router.get('/inventory/csv', authenticate, authorize('retailer', 'admin'), retailerScope, handleValidation, async (req, res) => {
  try {
    const retailerId = await resolveScope(req);
    const { sql, params } = inventoryQuery(retailerId);
    const [rows] = await pool.query(sql, params);
    const csv = toCSV(
      [
        { key: 'retailer', label: 'Retailer' },
        { key: 'product', label: 'Product' },
        { key: 'category', label: 'Category' },
        { key: 'quantity', label: 'Quantity' },
        { key: 'low_stock_threshold', label: 'Low-Stock Threshold' },
        { key: 'stock_status', label: 'Status' }
      ],
      rows
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=inventory-report-${DATE()}.csv`);
    res.send(csv);
  } catch (err) {
    handleError(res, err, 'Failed to export inventory CSV');
  }
});

// ---- PDF exports ----
function renderTablePDF(doc, headers, rows, startY = 80) {
  const colWidth = 475 / headers.length;
  let y = startY;
  const rowH = 16;
  doc.font('Helvetica-Bold').fontSize(8);
  headers.forEach((h, i) => doc.text(h.label, 40 + i * colWidth, y, { width: colWidth - 4 }));
  y += rowH;
  doc.moveTo(40, y - 6).lineTo(40 + 475, y - 6).stroke();
  doc.font('Helvetica').fontSize(8);
  for (const row of rows) {
    headers.forEach((h, i) => doc.text(String(row[h.key] ?? ''), 40 + i * colWidth, y, { width: colWidth - 4 }));
    y += rowH;
    if (y > 750) {
      doc.addPage();
      y = 50;
    }
  }
  return y;
}

function sendPDF(res, filename, title, headers, rows) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  doc.pipe(res);
  doc.fontSize(14).font('Helvetica-Bold').text(title, 40, 40);
  doc.font('Helvetica').fontSize(9).text(`Generated: ${new Date().toLocaleString()}`, 40, 60);
  renderTablePDF(doc, headers, rows, 80);
  doc.end();
}

router.get('/sales/pdf', authenticate, authorize('retailer', 'admin'), retailerScope, handleValidation, async (req, res) => {
  try {
    const retailerId = await resolveScope(req);
    const { sql, params } = salesQuery(retailerId);
    const [rows] = await pool.query(sql, params);
    const scopeLabel = retailerId ? `Store #${retailerId}` : 'All stores';
    sendPDF(res, `sales-report-${DATE()}.pdf`, `Sales Report — ${scopeLabel}`, [
      { key: 'date', label: 'Date' },
      { key: 'order_id', label: 'Order' },
      { key: 'retailer', label: 'Retailer' },
      { key: 'product', label: 'Product' },
      { key: 'quantity', label: 'Qty' },
      { key: 'revenue', label: 'Revenue' },
      { key: 'profit', label: 'Profit' }
    ], rows);
  } catch (err) {
    handleError(res, err, 'Failed to export sales PDF');
  }
});

router.get('/inventory/pdf', authenticate, authorize('retailer', 'admin'), retailerScope, handleValidation, async (req, res) => {
  try {
    const retailerId = await resolveScope(req);
    const { sql, params } = inventoryQuery(retailerId);
    const [rows] = await pool.query(sql, params);
    const scopeLabel = retailerId ? `Store #${retailerId}` : 'All stores';
    sendPDF(res, `inventory-report-${DATE()}.pdf`, `Inventory Report — ${scopeLabel}`, [
      { key: 'retailer', label: 'Retailer' },
      { key: 'product', label: 'Product' },
      { key: 'category', label: 'Category' },
      { key: 'quantity', label: 'Qty' },
      { key: 'low_stock_threshold', label: 'Threshold' },
      { key: 'stock_status', label: 'Status' }
    ], rows);
  } catch (err) {
    handleError(res, err, 'Failed to export inventory PDF');
  }
});

module.exports = router;