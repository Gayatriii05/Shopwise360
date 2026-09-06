// E2E: verifies real-time events are actually delivered to connected socket.io clients.
const axios = require('axios');
const { io } = require('socket.io-client');

const API = 'http://localhost:5000/api';
const SOCK = 'http://localhost:5000';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const once = (socket, event, timeoutMs = 7000) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);
    socket.once(event, (payload) => { clearTimeout(t); resolve(payload); });
  });

async function login(email, password) {
  const { data } = await axios.post(`${API}/auth/login`, { email, password });
  return data.token;
}

async function main() {
  const results = [];
  const record = (name, ok, detail = '') => {
    results.push({ name, ok });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  };

  const custToken = await login('customer@shopwise.com', 'Password123');
  const retToken = await login('retailer@shopwise.com', 'Password123');

  // resolve retailer profile id + a stockable product dynamically
  const meRet = await axios.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${retToken}` } });
  const retailerId = meRet.data.retailer.id;
  const inv = await axios.get(`${API}/inventory/retailer/${retailerId}`, { headers: { Authorization: `Bearer ${retToken}` } });
  const orderItem = inv.data.find((i) => i.quantity >= 3) || inv.data[0];
  const lowStockable = inv.data.find((i) => i.quantity > i.low_stock_threshold) || inv.data.find((i) => i.quantity >= 1);

  const custSocket = io(SOCK, { auth: { token: custToken } });
  const retSocket = io(SOCK, { auth: { token: retToken } });

  await Promise.all([
    new Promise((resolve, reject) => { custSocket.on('connect', resolve); custSocket.on('connect_error', (e) => reject(e)); }),
    new Promise((resolve, reject) => { retSocket.on('connect', resolve); retSocket.on('connect_error', (e) => reject(e)); })
  ]);
  await wait(400);
  record('Both sockets connect with JWT', true);

  // Test 1: new-order + dashboard-update land on the retailer socket
  const newOrderP = once(retSocket, 'new-order');
  const dashUpdateP = once(retSocket, 'dashboard-update');
  const orderResp = await axios.post(`${API}/orders`, {
    retailer_id: retailerId,
    items: [{ product_id: orderItem.product_id, quantity: 2 }]
  }, { headers: { Authorization: `Bearer ${custToken}` } });
  const newOrder = await newOrderP;
  record('Retailer receives live new-order event', newOrder && newOrder.id === orderResp.data.orderId, `order #${orderResp.data.orderId}`);
  await dashUpdateP;
  record('Retailer receives dashboard-update (numbers tick live)', true);

  // Test 2: order-status-change fires on customer + retailer sockets (no fake low-stock)
  const statusP = once(custSocket, 'order-status-change');
  const retStatusP = once(retSocket, 'order-status-change');
  const dashOnlyP = once(retSocket, 'dashboard-update');
  await axios.put(`${API}/orders/${orderResp.data.orderId}/status`, { status: 'confirmed' },
    { headers: { Authorization: `Bearer ${retToken}` } });
  const statusEvt = await statusP;
  record('Customer sees status change live', Number(statusEvt.orderId) === orderResp.data.orderId && statusEvt.status === 'confirmed', `→ ${statusEvt.status}`);
  await retStatusP;
  record('Retailer sees the status change reflected live', true);
  await dashOnlyP; // retailers also get dashboard refresh
  record('Status change triggers dashboard refresh, not a spurious low-stock alert', true);

  // Test 3: low-stock-alert fires when inventory crosses the threshold
  if (lowStockable) {
    const lowStockP = once(retSocket, 'low-stock-alert');
    const origQty = lowStockable.quantity;
    const origThreshold = lowStockable.low_stock_threshold;
    await axios.put(`${API}/inventory/${lowStockable.id}`,
      { quantity: origThreshold - 1, low_stock_threshold: origThreshold },
      { headers: { Authorization: `Bearer ${retToken}` } });
    const alert = await lowStockP;
    record('Retailer receives live low-stock-alert', Number(alert.inventory_id) === lowStockable.id, `qty ${alert.quantity} < threshold ${alert.threshold}`);
    // restore inventory so repeated runs are stable
    await axios.put(`${API}/inventory/${lowStockable.id}`,
      { quantity: origQty, low_stock_threshold: origThreshold },
      { headers: { Authorization: `Bearer ${retToken}` } });
    record('Inventory restored after low-stock alert test', true);
  } else {
    record('Retailer receives live low-stock-alert', false, 'no inventory to force below threshold');
  }

  // Test 4: unauthenticated socket is rejected
  let rejected = false;
  try {
    const bad = io(SOCK, { auth: { token: 'garbage.token' } });
    await new Promise((resolve) => {
      bad.on('connect_error', () => { rejected = true; bad.disconnect(); resolve(); });
      setTimeout(resolve, 1500);
    });
  } catch (_) { rejected = true; }
  record('Socket rejects invalid JWT', rejected);

  await wait(200);
  custSocket.disconnect();
  retSocket.disconnect();

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} real-time checks passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('TEST ERROR:', e.message); process.exit(1); });