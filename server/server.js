require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const cron = require('node-cron');
const pool = require('./config/db');
const { initSocket, emitLowStockAlert } = require('./socket');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const inventoryRoutes = require('./routes/inventory');
const orderRoutes = require('./routes/orders');
const dashboardRoutes = require('./routes/dashboard');
const mlRoutes = require('./routes/ml');
const wishlistRoutes = require('./routes/wishlist');
const retailerRoutes = require('./routes/retailers');
const couponRoutes = require('./routes/coupons').router;
const reportRoutes = require('./routes/reports');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ml', mlRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/retailers', retailerRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/reports', reportRoutes);

// Global error handler — always responds with the consistent { error } shape.
// Route handlers that already respond in their own try/catch never reach here;
// this catches malformed JSON, multer upload failures and any unhandled throw.
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON in request body' });
  }
  if (err.name === 'MulterError') {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({ error: err.message });
  }
  const status = err.statusCode || 500;
  if (status >= 500) console.error(err.stack);
  res.status(status).json({
    error: status >= 500 ? 'Something went wrong' : (err.message || 'Request failed')
  });
});

// Background job: scan all inventory every hour, create alerts for anything under threshold
// that doesn't already have an unresolved alert (avoids duplicate spam)
cron.schedule('0 * * * *', async () => {
  try {
    const [lowStockItems] = await pool.query(`
      SELECT i.id, i.retailer_id, i.quantity, i.low_stock_threshold
      FROM inventory i
      WHERE i.quantity <= i.low_stock_threshold
    `);
    for (const item of lowStockItems) {
      const [existing] = await pool.query(
        'SELECT id FROM stock_alerts WHERE inventory_id = ? AND resolved = FALSE',
        [item.id]
      );
      if (!existing.length) {
        await pool.query(
          'INSERT INTO stock_alerts (inventory_id, message) VALUES (?, ?)',
          [item.id, `Auto-check: quantity ${item.quantity} at/below threshold ${item.low_stock_threshold}`]
        );
        emitLowStockAlert(item.retailer_id, {
          inventory_id: item.id, quantity: item.quantity, threshold: item.low_stock_threshold
        });
      }
    }
    console.log(`[cron] Low-stock scan complete: ${lowStockItems.length} items checked`);
  } catch (err) {
    console.error('[cron] Low-stock scan failed:', err.message);
  }
});

const PORT = process.env.PORT || 5000;
const httpServer = http.createServer(app);
initSocket(httpServer);
httpServer.listen(PORT, () => console.log(`ShopWise 360 server running on port ${PORT}`));
