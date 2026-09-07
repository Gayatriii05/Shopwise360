const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const pool = require('./config/db');

let io = null;

const ROOM = {
  retailer: (id) => `retailer-${id}`,
  customer: (id) => `customer-${id}`,
  supplier: (id) => `supplier-${id}`,
};

function initSocket(server) {
  io = new Server(server, {
    cors: { origin: '*' }
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('No token provided'));
    try {
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      if (socket.user.type === 'refresh') {
        return next(new Error('Refresh tokens cannot be used for realtime connection'));
      }
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', async (socket) => {
    const { id, role } = socket.user;
    try {
      if (role === 'retailer') {
        const [rows] = await pool.query('SELECT id FROM retailers WHERE user_id = ?', [id]);
        if (rows.length) socket.join(ROOM.retailer(rows[0].id));
      } else if (role === 'customer') {
        socket.join(ROOM.customer(id));
      } else if (role === 'supplier') {
        const [rows] = await pool.query('SELECT id FROM suppliers WHERE user_id = ?', [id]);
        if (rows.length) socket.join(ROOM.supplier(rows[0].id));
      }
    } catch (err) {
      console.error('[socket] room join failed:', err.message);
    }
    console.log(`[socket] connected: user ${id} (${role})`);
  });

  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}

// --- Event helpers (used by routes) ---

// Retailer sees a new order land + dashboard numbers update
function emitNewOrder(retailerId, order) {
  const sio = getIO();
  sio.to(ROOM.retailer(retailerId)).emit('new-order', order);
  sio.to(ROOM.retailer(retailerId)).emit('dashboard-update', { retailerId });
}

// Customer + retailer see a status change live
function emitOrderStatusChange(customerId, retailerId, orderId, status) {
  const sio = getIO();
  sio.to(ROOM.customer(customerId)).emit('order-status-change', { orderId, status });
  sio.to(ROOM.retailer(retailerId)).emit('order-status-change', { orderId, status, customerId });
}

// Low-stock alert pushed the moment inventory crosses the threshold
function emitLowStockAlert(retailerId, alert) {
  const sio = getIO();
  sio.to(ROOM.retailer(retailerId)).emit('low-stock-alert', alert);
  sio.to(ROOM.retailer(retailerId)).emit('dashboard-update', { retailerId });
}

// Retireler dashboard numbers refresh (no event payload fetch needed by client)
function emitDashboardUpdate(retailerId) {
  const sio = getIO();
  sio.to(ROOM.retailer(retailerId)).emit('dashboard-update', { retailerId });
}

module.exports = { initSocket, getIO, emitNewOrder, emitOrderStatusChange, emitLowStockAlert, emitDashboardUpdate, ROOM };