// Phase 7 verification: email notifications (order confirm / status change /
// low-stock), Swagger API docs, and the admin audit log.
//
// The email checks spawn a dedicated server (port 5007) in MAIL_TRANSPORT=json
// "transport" mode that dumps each composed message to a temp dir instead of
// SMTP — so the wiring (which event sends which mail to whom) is asserted
// deterministically. Swagger/audit checks run against that same instance.
//
// Requires: MySQL running + seeded DB. Run from tests/:  npm run verify:phase7
const axios = require('axios');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

const PASSWORD = 'Password123';
const PORT = Number(process.env.PHASE7_PORT || 5007);
const API = `http://127.0.0.1:${PORT}/api`;
const SERVER_DIR = path.resolve(__dirname, '..', 'server');
const MAIL_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sw360-mail-'));

const results = [];
function record(name, ok, detail = '', skip = false) {
  results.push({ name, ok, skip });
  console.log(`${ok ? 'PASS' : skip ? 'SKIP' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}
function envValue(key) {
  const line = fs.readFileSync(path.resolve(SERVER_DIR, '.env'), 'utf8')
    .split(/\r?\n/).map((l) => l.trim()).find((l) => l.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1) : '';
}
function mysqlExec(sql) {
  try {
    execFileSync('C:/Program Files/MySQL/MySQL Server 8.0/bin/mysql.exe',
      ['-u', envValue('DB_USER') || 'root', '-h', envValue('DB_HOST') || 'localhost', envValue('DB_NAME') || 'shopwise360', '-N', '-B', '-e', sql],
      { env: { ...process.env, MYSQL_PWD: envValue('DB_PASSWORD') }, encoding: 'utf8' });
  } catch (_e) { /* best-effort */ }
}

async function api(method, url, { token, data, params, responseType } = {}) {
  const h = token ? { Authorization: `Bearer ${token}` } : {};
  return axios({ method, url: `${API}${url}`, data, params, headers: h, responseType, validateStatus: () => true });
}

const EMAILS = { customer: 'customer@shopwise.com', retailer: 'retailer@shopwise.com', supplier: 'supplier@shopwise.com', admin: 'admin@shopwise.com' };
async function login(role) {
  const r = await api('post', '/auth/login', { data: { email: EMAILS[role], password: PASSWORD } });
  return r.data;
}

function waitFor(fn, timeout = 10000, every = 150) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const tick = async () => {
      try { if (await fn()) return resolve(true); } catch (_e) {}
      if (Date.now() - t0 > timeout) return resolve(false);
      setTimeout(tick, every);
    };
    tick();
  });
}

function allMails() {
  return fs.readdirSync(MAIL_DIR).map((f) => {
    try { return JSON.parse(fs.readFileSync(path.join(MAIL_DIR, f), 'utf8')); } catch (_e) { return null; }
  }).filter(Boolean);
}

let server;
function startServer() {
  return new Promise((resolve, reject) => {
    server = spawn('node', ['server.js'], {
      cwd: SERVER_DIR,
      env: { ...process.env, PORT: String(PORT), MAIL_TRANSPORT: 'json', MAIL_DUMP_DIR: MAIL_DIR, AUTH_RATE_MAX: '60' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    server.stdout.on('data', (d) => process.env.PHASE7_VERBOSE === '1' && process.stdout.write(String(d)));
    server.stderr.on('data', (d) => process.env.PHASE7_VERBOSE === '1' && process.stderr.write(String(d)));
    waitFor(async () => (await api('get', '/health')).status === 200, 15000).then((ok) =>
      ok ? resolve() : reject(new Error('server did not boot')));
  });
}
function stopServer() {
  if (server) { try { server.kill(); } catch (_e) {} }
}

async function main() {
  console.log(`--- Phase 7 verification (server :${PORT}, mail dump: ${MAIL_DIR}) ---`);
  await startServer();

  try {
    const customers = await login('customer');
    const retailer = await login('retailer');
    const retailerId = (await api('get', '/auth/me', { token: retailer.token })).data.retailer.id;
    const retailerInfo = (await api('get', '/retailers')).data.find((r) => r.id === retailerId) || {};
    const storeName = retailerInfo.store_name || 'Rita General Store';

    // ---------- ITEM 1: email wiring ----------
    const inv = (await api('get', `/inventory/retailer/${retailerId}`, { token: retailer.token })).data;
    const safeItem = inv.find((i) => Number(i.quantity) - 2 > Number(i.low_stock_threshold)) || inv[0];

    // 1a) order confirmation
    const orderRes = await api('post', '/orders', {
      token: customers.token,
      data: { retailer_id: retailerId, items: [{ product_id: safeItem.product_id, quantity: 2 }] }
    });
    record('order placed (email trigger)', orderRes.status === 201, `orderId=${orderRes.data.orderId}`);
    if (orderRes.status === 201) {
      const id = orderRes.data.orderId;
      const found = await waitFor(async () => allMails().some((m) => m.subject === `Order #${id} confirmed — ${storeName}`));
      const mails = allMails();
      const confirmMail = mails.find((m) => m.subject === `Order #${id} confirmed — ${storeName}`);
      record('order-confirmation email to customer',
        found && !!confirmMail && confirmMail.to === EMAILS.customer,
        confirmMail ? `subject="${confirmMail.subject}"` : 'no matching mail');
      record('order-confirmation carries total + items',
        !!confirmMail && confirmMail.text.includes(`Total: ₹${Number(orderRes.data.total).toFixed(2)}`) && confirmMail.text.includes(safeItem.name),
        `total=${orderRes.data.total}`);

      // 1b) status change
      const adv = await api('put', `/orders/${id}/status`, { token: retailer.token, data: { status: 'confirmed' } });
      record('order status advance (email trigger)', adv.status === 200, `status=${adv.data.status}`);
      const statusFound = await waitFor(async () => allMails().some((m) => m.subject === `Order #${id} confirmed` && m.text.includes('is now confirmed')));
      const statusMail = allMails().find((m) => m.subject === `Order #${id} confirmed` && m.text.includes('is now confirmed'));
      record('status-change email to customer',
        statusFound && !!statusMail && statusMail.to === EMAILS.customer,
        statusMail ? `subject="${statusMail.subject}"` : 'no matching mail');
    }

    // 1c) low-stock email (raise stock, then drop below threshold, then restore)
    const target = inv.find((i) => Number(i.quantity) > Number(i.low_stock_threshold)) || inv[0];
    const lowQty = Math.max(Number(target.low_stock_threshold) - 1, 0);
    const lowRes = await api('put', `/inventory/${target.id}`, { token: retailer.token, data: { quantity: lowQty, low_stock_threshold: target.low_stock_threshold } });
    record('low-stock trigger accepted', lowRes.status === 200, `inventory #${target.id} → ${lowQty}`);
    const lowFound = await waitFor(async () => allMails().some((m) => m.subject.startsWith('Low stock:') && m.to === EMAILS.retailer));
    const lowMail = allMails().find((m) => m.subject.startsWith('Low stock:') && m.to === EMAILS.retailer);
    record('low-stock email to retailer',
      lowFound && !!lowMail && lowMail.text.includes(`Current quantity: ${lowQty}`),
      lowMail ? `subject="${lowMail.subject}"` : 'no matching mail');
    // restore stock + flag the alert resolved so the DB stays clean
    await api('put', `/inventory/${target.id}`, { token: retailer.token, data: { quantity: target.quantity, low_stock_threshold: target.low_stock_threshold } });
    mysqlExec(`UPDATE stock_alerts SET resolved=1 WHERE inventory_id=${target.id}`);

    // ---------- ITEM 2: API docs (swagger) ----------
    const specRes = await api('get', '/docs/swagger.json');
    record('swagger spec JSON served', specRes.status === 200, `status=${specRes.status}`);
    const spec = specRes.data || {};
    record('spec is OpenAPI 3.0.0', spec.openapi === '3.0.0', `openapi=${spec.openapi}`);
    const expectedPaths = ['/api/health', '/api/auth/login', '/api/products', '/api/inventory', '/api/orders', '/api/ml/retrain'];
    const missingSpec = expectedPaths.filter((p) => !(spec.paths || {})[p]);
    record('core routes documented', missingSpec.length === 0, missingSpec.length ? `missing ${missingSpec.join(', ')}` : `${Object.keys(spec.paths || {}).length} paths total`);
    const secured = ['/api/orders', '/api/inventory', '/api/products'];
    const lacksSecurity = secured.filter((p) => !((spec.paths || {})[p] || {}).post || !(((spec.paths || {})[p] || {}).post || {}).security);
    record('protected routes require bearerAuth', lacksSecurity.length === 0, lacksSecurity.length ? `no security on ${lacksSecurity.join(', ')}` : 'bearerAuth present');
    const loginOp = ((spec.paths || {})['/api/auth/login'] || {}).post || {};
    record('public login route unsecured', !loginOp.security || loginOp.security.length === 0, 'no security requirement');
    const ui = await api('get', '/docs/');
    record('swagger UI served', ui.status === 200 && /swagger-ui/i.test(ui.data || ''), `status=${ui.status}`);
    const healthSpec = ((spec.paths || {})['/api/health'] || {}).get || {};
    record('health documented', !!healthSpec.summary, `summary="${healthSpec.summary}"`);

    // ---------- ITEM 3: admin audit log ----------
    const admin = await login('admin');

    // 3a) access control: only admins may read the log
    record('audit rejected for retail (403)', (await api('get', '/audit', { token: retailer.token })).status === 403, 'retailer');
    record('audit rejected for customers (403)', (await api('get', '/audit', { token: customers.token })).status === 403, 'customer');
    record('audit rejected anonymous (401)', (await api('get', '/audit')).status === 401, 'no token');

    // 3b) coupon create/delete are logged
    const couponCode = `VFY${Date.now()}`;
    const couponRes = await api('post', '/coupons', { token: admin.token, data: { code: couponCode, discount_type: 'percent', discount_value: 10 } });
    record('coupon created (audit trigger)', couponRes.status === 201, `code=${couponCode}`);
    const couponId = couponRes.data.id;
    const createLogged = await waitFor(async () => {
      const r = await api('get', `/audit?action=coupon.create&entity_id=${couponId}`, { token: admin.token });
      return r.status === 200 && r.data.items.some((a) => a.details && a.details.code === couponCode);
    });
    record('coupon.create audit row written', createLogged, `entity_id=${couponId}`);
    await api('delete', `/coupons/${couponId}`, { token: admin.token });
    const deleteLogged = await waitFor(async () => {
      const r = await api('get', `/audit?action=coupon.delete&entity_id=${couponId}`, { token: admin.token });
      return r.status === 200 && r.data.items.some((a) => a.details && a.details.code === couponCode);
    });
    record('coupon.delete audit row written', deleteLogged, `entity_id=${couponId}`);

    // 3c) product create/delete are logged
    const prodName = `Phase7 Verify ${Date.now()}`;
    const prodRes = await api('post', '/products', { token: admin.token, data: { name: prodName, cost_price: 10, sale_price: 15 } });
    record('product created (audit trigger)', prodRes.status === 201, `name="${prodName}"`);
    const productId = prodRes.data.id;
    const prodCreated = await waitFor(async () => {
      const r = await api('get', `/audit?action=product.create&entity_id=${productId}`, { token: admin.token });
      return r.status === 200 && r.data.items.some((a) => a.details && a.details.name === prodName);
    });
    record('product.create audit row written', prodCreated, `entity_id=${productId}`);
    await api('delete', `/products/${productId}`, { token: admin.token });
    const prodDeleted = await waitFor(async () => {
      const r = await api('get', `/audit?action=product.delete&entity_id=${productId}`, { token: admin.token });
      return r.status === 200 && r.data.items.length > 0;
    });
    record('product.delete audit row written', prodDeleted, `entity_id=${productId}`);

    // 3d) order status changes (from item 1 flow) are logged with old/new status
    const statusLogged = await waitFor(async () => {
      const r = await api('get', `/audit?action=order.status&entity_id=${orderRes.data.orderId}`, { token: admin.token });
      const row = r.status === 200 && r.data.items.find((a) => a.details && a.details.newStatus === 'confirmed');
      return !!row;
    });
    record('order.status audit row written (old→new)', statusLogged, `orderId=${orderRes.data.orderId}`);

    // 3e) ML retrain is logged (best-effort — skipped when the ML service is down)
    const retrainRes = await api('post', '/ml/retrain', { token: admin.token, data: { target: 'recommend' } });
    if (retrainRes.status === 200) {
      const retrainLogged = await waitFor(async () => {
        const r = await api('get', `/audit?action=model.retrain`, { token: admin.token });
        return r.status === 200 && r.data.items.some((a) => a.details && a.details.target === 'recommend');
      }, 20000);
      record('model.retrain audit row written', retrainLogged, 'target=recommend');
    } else {
      record('model.retrain audit row written (ML down)', retrainRes.status === 502 && retrainRes.status, 'SKIP — ml-service offline', true);
    }

    // 3f) listing shape + filters + pagination
    const list = await api('get', '/audit?limit=5&page=1', { token: admin.token });
    const shape = list.status === 200 && Array.isArray(list.data.items)
      && list.data.items.length <= 5 && Number.isInteger(list.data.total) && Number(list.data.totalPages) >= 1;
    record('audit listing shape (items/page/limit/total/totalPages)', shape, `total=${list.data.total}`);
    const actionFilter = await api('get', '/audit?action=coupon.create&limit=50', { token: admin.token });
    record('action filter restricts results',
      actionFilter.status === 200 && actionFilter.data.items.every((a) => a.action === 'coupon.create'),
      `rows=${actionFilter.data.items.length}`);
    record('audit entries carry actor + timestamp',
      list.status === 200 && list.data.items.every((a) => a.actor_id && a.actor_role && a.created_at),
      `actor_role sample=${list.data.items[0] && list.data.items[0].actor_role}`);
    // (filled in as the endpoints ship)
  } finally {
    stopServer();
  }

  const passed = results.filter((r) => r.ok && !r.skip).length;
  const skipped = results.filter((r) => r.skip).length;
  const failed = results.filter((r) => !r.ok && !r.skip).length;
  console.log(`\n--- ${passed} passed, ${failed} failed, ${skipped} skipped ---`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => { console.error('fatal:', err.message); stopServer(); process.exit(1); });