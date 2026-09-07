// Phase 0.3 audit: end-to-end verification of every item checked in PROJECT_REPORT.md.
// Exercises real HTTP routes (login, CRUD, orders, wishlist, dashboards, ML proxy, uploads).
// Requires: server (5000), ml-service (6000) running and seeded DB.
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const API = 'http://localhost:5000/api';
const PASSWORD = 'Password123';
const results = [];
const facts = [];

// ---- mysql helper (reads credentials from server/.env, never logs the password) ----
function envValue(key) {
  const line = fs.readFileSync(path.resolve(__dirname, '../server/.env'), 'utf8')
    .split(/\r?\n/).map((l) => l.trim()).find((l) => l.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1) : '';
}
function db(sql) {
  const env = {
    ...process.env,
    MYSQL_PWD: envValue('DB_PASSWORD')
  };
  const args = ['-u', envValue('DB_USER') || 'root', '-h', envValue('DB_HOST') || 'localhost', envValue('DB_NAME') || 'shopwise360', '-N', '-B', '-e', sql];
  return execFileSync(path.join('C:', 'Program Files', 'MySQL', 'MySQL Server 8.0', 'bin', 'mysql.exe'), args, { env, encoding: 'utf8' }).trim();
}

function record(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (/^#/.test(name)) facts.push({ name: name.slice(2), detail });
}

async function login(email) {
  const { data } = await axios.post(`${API}/auth/login`, { email, password: PASSWORD });
  return data;
}

async function api(method, url, { token, data, params, headers } = {}) {
  const h = { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers };
  return axios({ method, url: `${API}${url}`, data, params, headers: h, validateStatus: () => true });
}

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

async function main() {
  // ---------- AUTH / RBAC ----------
  const roles = {};
  for (const [role, email] of [['admin', 'admin@shopwise.com'], ['supplier', 'supplier@shopwise.com'], ['retailer', 'retailer@shopwise.com'], ['customer', 'customer@shopwise.com']]) {
    try {
      const r = await login(email);
      roles[role] = r;
      record(`#auth ${role} login`, r.token && r.user.role === role, `role=${r.user.role}`);
    } catch (e) {
      record(`#auth ${role} login`, false, e.message);
    }
  }

  // register (new customer) + duplicate email
  const uniq = `audit_${Date.now()}@test.com`;
  let reg = await api('post', '/auth/register', { data: { name: 'Audit User', email: uniq, password: 'secret123', role: 'customer' } });
  record('#auth register new customer', reg.status === 201 && reg.data.token, `status=${reg.status}`);
  reg = await api('post', '/auth/register', { data: { name: 'Audit User', email: uniq, password: 'secret123', role: 'customer' } });
  record('#auth register duplicate email -> 409', reg.status === 409, `status=${reg.status}`);

  // /auth/me profile resolution
  const meR = await api('get', '/auth/me', { token: roles.customer.token });
  record('#auth me resolves customer (id + wishlist_count)', meR.status === 200 && meR.data.id > 0 && 'wishlist_count' in meR.data);
  const meRt = await api('get', '/auth/me', { token: roles.retailer.token });
  const meSup = await api('get', '/auth/me', { token: roles.supplier.token });
  record('#auth me resolves retailer profile row', meRt.status === 200 && meRt.data.retailer && meRt.data.retailer.id > 0, `retailer.id=${meRt.data.retailer && meRt.data.retailer.id}`);
  record('#auth me resolves supplier profile row', meSup.status === 200 && meSup.data.supplier && meSup.data.supplier.id > 0, `supplier.id=${meSup.data.supplier && meSup.data.supplier.id}`);

  const custId = meR.data.id;
  const retailerId = meRt.data.retailer.id;
  const supplierId = meSup.data.supplier.id;

  // RBAC
  const nz = await api('get', `/dashboard/retailer/${retailerId}/summary`);
  record('#auth no token -> 401', nz.status === 401, `status=${nz.status}`);
  const cuz = await api('get', `/dashboard/retailer/${retailerId}/summary`, { token: roles.customer.token });
  record('#auth customer blocked from retailer route -> 403', cuz.status === 403, `status=${cuz.status}`);

  // ---------- PRODUCTS: list / search / filter / sort / pagination ----------
  let r = await api('get', '/products?limit=12');
  record('#products list+pagination', r.status === 200 && Array.isArray(r.data.products) && r.data.pagination && r.data.pagination.total > 0, `total=${r.data.pagination && r.data.pagination.total}`);
  const allProducts = r.data.products;

  r = await api('get', '/products', { params: { search: 'rice', limit: 12 } });
  record('#products search', r.status === 200 && r.data.products.length >= 1, `${r.data.products.length} hit(s)`);

  const catRes = await axios.get(`${API}/products/categories`);
  record('#products categories', catRes.status === 200 && catRes.data.length >= 5, `count=${catRes.data.length}`);
  const electronics = catRes.data.find((c) => c.name === 'Electronics');

  r = await api('get', '/products', { params: { category_id: electronics.id, limit: 100 } });
  const catOk = r.status === 200 && r.data.products.length >= 3 && r.data.products.every((p) => p.category_id === electronics.id);
  record('#products category filter', catOk, `count=${r.data.products.length}`);

  const asc = await api('get', '/products', { params: { sort: 'price_asc', limit: 100 } });
  const desc = await api('get', '/products', { params: { sort: 'price_desc', limit: 100 } });
  const pAsc = asc.data.products.map((p) => Number(p.sale_price));
  const pDesc = desc.data.products.map((p) => Number(p.sale_price));
  record('#products sort price asc/desc', pAsc.every((v, i) => i === 0 || v >= pAsc[i - 1]) && pDesc.every((v, i) => i === 0 || v <= pDesc[i - 1]));

  const p2 = await api('get', '/products', { params: { page: 2, limit: 12 } });
  record('#products pagination page 2', p2.data.pagination.page === 2 && p2.data.pagination.limit === 12);

  // detail with rating + reviews
  const detail = await api('get', `/products/${allProducts[0].id}`);
  record('#products detail (rating + reviews)', detail.status === 200 && 'rating' in detail.data && 'review_count' in detail.data && Array.isArray(detail.data.reviews));

  // ---------- PRODUCT CREATION WITH IMAGE UPLOAD ----------
  const fd = new FormData();
  fd.append('name', `Audit Product ${Date.now()}`);
  fd.append('description', 'Created by phase0 audit');
  fd.append('category_id', String(electronics.id));
  fd.append('cost_price', '100');
  fd.append('sale_price', '250');
  fd.append('supplier_id', String(supplierId));
  fd.append('image', new Blob([TINY_PNG], { type: 'image/png' }), 'audit.png');
  const created = await api('post', '/products', { token: roles.supplier.token, data: fd });
  const createdOk = created.status === 201 && /^\/uploads\//.test(created.data.image_url);
  record('#products create w/ image upload', createdOk, `status=${created.status} url=${created.data.image_url}`);
  const newProductId = created.data.id;

  // image actually served
  const imgPath = path.join(__dirname, '..', 'server', created.data.image_url);
  const imgServed = fs.existsSync(imgPath) && created.data.image_url;
  record('#uploads image stored on disk + servable', imgServed);
  if (created.data.image_url) {
    const imgResp = await axios.get(`http://localhost:5000${created.data.image_url}`, { validateStatus: () => true });
    const existingImg = await axios.get('http://localhost:5000/uploads/product-1788616728309-730668935.jpg', { validateStatus: () => true });
    record('#uploads GET returns image bytes', imgResp.status === 200 && imgResp.headers['content-type'].startsWith('image') && existingImg.status === 200, `new=${imgResp.status} existing=${existingImg.status}`);
  }

  // update product
  const upd = await api('put', `/products/${newProductId}`, { token: roles.supplier.token, data: { name: 'Audit Product Renamed', description: 'updated', category_id: electronics.id, cost_price: 120, sale_price: 260 } });
  const updCheck = await api('get', `/products/${newProductId}`);
  record('#products update', upd.status === 200 && updCheck.data.name === 'Audit Product Renamed');

  // delete (after inventory test so we can attach inventory first)
  // defer delete to end

  // ---------- INVENTORY (retailer, lows-stock, update creates alert, create) ----------
  r = await api('get', `/inventory/retailer/${retailerId}`, { token: roles.retailer.token });
  record('#inventory list', r.status === 200 && Array.isArray(r.data) && r.data.length >= 8, `count=${r.data.length}`);
  const invList = r.data;
  facts.push({ name: 'audit:inventory:stock_before', detail: invList.map((i) => `${i.product_id}=${i.quantity}`).join(',') });

  r = await api('get', `/inventory/retailer/${retailerId}/low-stock`, { token: roles.retailer.token });
  record('#inventory low-stock list', r.status === 200 && r.data.length >= 1 && r.data.every((i) => i.quantity <= i.low_stock_threshold), `count=${r.data.length}`);

  // pick an item above threshold, drive it below → alert + low-stock appears
  const above = invList.filter((i) => i.quantity > i.low_stock_threshold)[0] || invList[0];
  const up = await api('put', `/inventory/${above.id}`, { token: roles.retailer.token, data: { quantity: above.low_stock_threshold - 1, low_stock_threshold: above.low_stock_threshold } });
  const lowAfter = await api('get', `/inventory/retailer/${retailerId}/low-stock`, { token: roles.retailer.token });
  const inLowList = lowAfter.data.some((i) => i.inventory_id === above.id);
  record('#inventory update below threshold (alert path)', up.status === 200 && inLowList, `inventory_id=${above.id}`);
  facts.push({ name: 'audit:alert:inventory_id', detail: String(above.id) });
  // restore
  await api('put', `/inventory/${above.id}`, { token: roles.retailer.token, data: { quantity: above.quantity, low_stock_threshold: above.low_stock_threshold } });

  // create inventory record for the new product
  const invNew = await api('post', '/inventory', { token: roles.retailer.token, data: { product_id: newProductId, retailer_id: retailerId, quantity: 25, low_stock_threshold: 5 } });
  record('#inventory create record', invNew.status === 201);

  // ---------- ORDERS: transactional placement, status flow ----------
  const stockable = (await api('get', `/inventory/retailer/${retailerId}`, { token: roles.retailer.token })).data;
  const target = stockable.find((i) => i.quantity > 5) || stockable[0];
  const preQty = target.quantity;
  const preTotals = (await api('get', `/dashboard/retailer/${retailerId}/summary`, { token: roles.retailer.token })).data.totals;

  const orderResp = await api('post', '/orders', { token: roles.customer.token, data: { retailer_id: retailerId, items: [{ product_id: target.product_id, quantity: 2 }] } });
  const orderId = orderResp.data.orderId;
  record('#orders place (transactional)', orderResp.status === 201 && orderId > 0, `orderId=${orderId}`);

  const invAfter = (await api('get', `/inventory/retailer/${retailerId}`, { token: roles.retailer.token })).data.find((i) => i.id === target.id);
  record('#orders inventory decremented', invAfter.quantity === preQty - 2, `was ${preQty} now ${invAfter.quantity}`);

  const totalsAfter = (await api('get', `/dashboard/retailer/${retailerId}/summary`, { token: roles.retailer.token })).data.totals;
  record('#orders sale + profit recorded (dashboard grew)', Number(totalsAfter.total_orders) === Number(preTotals.total_orders) + 1 && Number(totalsAfter.total_revenue) >= Number(preTotals.total_revenue));
  facts.push({ name: 'audit:orders:sales_recorded', detail: `revenue +${Number(totalsAfter.total_revenue) - Number(preTotals.total_revenue)}` });

  // oversell → guarded, rolls back, and reports a proper 409 (not a 500)
  const ob = (await api('get', `/inventory/retailer/${retailerId}`, { token: roles.retailer.token })).data.find((i) => i.quantity < 10);
  const beforeOrdersCount = (await api('get', `/orders/customer/${custId}`, { token: roles.customer.token })).data.length;
  const badResp = await api('post', '/orders', { token: roles.customer.token, data: { retailer_id: retailerId, items: [{ product_id: ob.product_id, quantity: 99999 }] } });
  const obInv = (await api('get', `/inventory/retailer/${retailerId}`, { token: roles.retailer.token })).data.find((i) => i.id === ob.id);
  const afterOrdersCount = (await api('get', `/orders/customer/${custId}`, { token: roles.customer.token })).data.length;
  record('#orders oversell blocked + rollback', badResp.status === 409 && /Insufficient stock/.test(badResp.data.error) && afterOrdersCount === beforeOrdersCount && obInv.quantity === ob.quantity, `status=${badResp.status}`);

  // multi-item order verification (pick two items with real stock)
  const two = stockable.filter((i) => i.quantity > 2).slice(0, 2);
  if (two.length === 2) {
    const multiResp = await api('post', '/orders', { token: roles.customer.token, data: { retailer_id: retailerId, items: [ { product_id: two[0].product_id, quantity: 1 }, { product_id: two[1].product_id, quantity: 1 } ] } });
    record('#orders multi-item order', multiResp.status === 201 && Number(multiResp.data.total) > 0, `orderId=${multiResp.data.orderId}, total=${multiResp.data.total}`);
  } else {
    record('#orders multi-item order', false, 'not enough stock for 2 items');
  }

  // ---------- ORDER STATUS FLOW ----------
  let sk = await api('put', `/orders/${orderId}/status`, { token: roles.retailer.token, data: { status: 'shipped' } });
  record('#orders status flow: skip denied (pending->shipped)', sk.status === 400, `status=${sk.status}`);
  sk = await api('put', `/orders/${orderId}/status`, { token: roles.retailer.token, data: { status: 'confirmed' } });
  record('#orders status flow: pending->confirmed', sk.status === 200);
  sk = await api('put', `/orders/${orderId}/status`, { token: roles.retailer.token, data: { status: 'delivered' } });
  const skip2Ok = sk.status === 400;
  sk = await api('put', `/orders/${orderId}/status`, { token: roles.retailer.token, data: { status: 'shipped' } });
  const shippedRes = sk;
  sk = await api('put', `/orders/${orderId}/status`, { token: roles.retailer.token, data: { status: 'delivered' } });
  record('#orders status flow: full pending->confirmed->shipped->delivered', skip2Ok && shippedRes.status === 200 && sk.status === 200);
  sk = await api('put', `/orders/${orderId}/status`, { token: roles.retailer.token, data: { status: 'confirmed' } });
  record('#orders status flow: backward move denied (delivered->confirmed)', sk.status === 400);
  sk = await api('put', `/orders/${orderId}/status`, { token: roles.retailer.token, data: { status: 'flying' } });
  record('#orders status flow: invalid status rejected', sk.status === 400);

  // cancel path from pending
  const canc = await api('post', '/orders', { token: roles.customer.token, data: { retailer_id: retailerId, items: [{ product_id: target.product_id, quantity: 1 }] } });
  const cancRes = await api('put', `/orders/${canc.data.orderId}/status`, { token: roles.retailer.token, data: { status: 'cancelled' } });
  record('#orders status flow: pending->cancelled allowed', cancRes.status === 200);

  r = await api('get', `/orders/customer/${custId}`, { token: roles.customer.token });
  record('#orders customer history + items', r.status === 200 && r.data.some((o) => o.id === orderId) && r.data[0].items && Array.isArray(r.data[0].items));
  r = await api('get', `/orders/retailer/${retailerId}`, { token: roles.retailer.token });
  record('#orders retailer list + customer info + items', r.status === 200 && r.data.some((o) => o.id === orderId) && r.data[0].customer_name && r.data[0].items);

  // ---------- WISHLIST ----------
  let w = await api('get', '/wishlist/mine', { token: roles.customer.token });
  const beforeW = w.data.length;
  const addW = await api('post', '/wishlist', { token: roles.customer.token, data: { product_id: allProducts[3].id } });
  const addW2 = await api('post', '/wishlist', { token: roles.customer.token, data: { product_id: allProducts[3].id } });
  w = await api('get', '/wishlist/mine', { token: roles.customer.token });
  record('#wishlist add (idempotent)', addW.status === 201 && addW2.status === 200 && w.data.length === beforeW + 1);
  const delW = await api('delete', `/wishlist/${allProducts[3].id}`, { token: roles.customer.token });
  w = await api('get', '/wishlist/mine', { token: roles.customer.token });
  record('#wishlist remove', delW.status === 200 && w.data.length === beforeW);

  // ---------- REVIEWS ----------
  // make the review pool deterministic across repeated runs: the seed customer's
  // previous audit reviews would otherwise exhaust every purchasable product,
  // turning "purchased customer can review" into a state-dependent flake.
  db(`DELETE FROM reviews WHERE customer_id=${custId}`);
  // negative: fresh customer (no purchase) blocked
  const fresh = await api('post', '/auth/register', { data: { name: 'Fresh Buyer', email: `fresh_${Date.now()}@test.com`, password: 'secret123', role: 'customer' } });
  const negRev = await api('post', `/products/${allProducts[0].id}/reviews`, { token: fresh.data.token, data: { rating: 5, comment: 'nope' } });
  record('#reviews non-purchaser rejected (403)', negRev.status === 403, `status=${negRev.status}`);
  // positive: seed customer reviewing a purchased-but-not-yet-reviewed product
  // try candidates (newest-neutral seed products) until one accepts the review
  let reviewPick = null;
  let reviewStatus = null;
  const cands = allProducts.map((p) => p.id);
  for (const pid of cands) {
    const tryRev = await api('post', `/products/${pid}/reviews`, { token: roles.customer.token, data: { rating: 4, comment: `Audit review ${Date.now()}` } });
    if (tryRev.status === 201) { reviewPick = pid; reviewStatus = 201; break; }
    if (tryRev.status === 500) break; // unrelated server error
  }
  const detailRev = reviewPick ? await api('get', `/products/${reviewPick}`) : null;
  record('#reviews purchased customer can review (verified)', reviewStatus === 201 && detailRev && detailRev.data.reviews.some((x) => x.comment.startsWith('Audit review')), `status=${reviewStatus}`);
  if (reviewPick) facts.push({ name: 'audit:reviews:created_for_product', detail: String(reviewPick) });

  // ---------- DASHBOARDS ----------
  r = await api('get', `/dashboard/retailer/${retailerId}/summary`, { token: roles.retailer.token });
  record('#dashboard retailer summary', r.status === 200 && r.data.totals && r.data.topProducts && r.data.categoryBreakdown && r.data.dailySales && r.data.lowStock);
  r = await api('get', '/dashboard/admin/summary', { token: roles.admin.token });
  record('#dashboard admin summary', r.status === 200 && r.data.totals && r.data.byRetailer && r.data.userCounts && r.data.topProductsPlatform);
  r = await api('get', `/dashboard/supplier/${supplierId}/summary`, { token: roles.supplier.token });
  record('#dashboard supplier summary', r.status === 200 && r.data.productPerformance && r.data.stockAcrossRetailers);

  // ---------- ML PROXY ----------
  r = await api('get', `/ml/recommend/${custId}`, { token: roles.customer.token });
  record('#ml recommend (collab, seeded customer)', r.status === 200 && Array.isArray(r.data) && r.data.length > 0, `recs=${r.data.length}`);
  r = await api('get', `/ml/recommend/999999`, { token: roles.customer.token });
  record('#ml recommend cold-start (popular fallback)', r.status === 200 && Array.isArray(r.data), `recs=${r.data.length}`);
  r = await api('get', `/ml/predict-demand/${retailerId}`, { token: roles.retailer.token });
  record('#ml predict-demand', r.status === 200 && Array.isArray(r.data) && r.data.length > 0, `preds=${r.data.length}`);
  facts.push({ name: 'audit:ml:retailer_id', detail: String(retailerId) });

  // ---------- RETAILERS PUBLIC ----------
  r = await api('get', '/retailers');
  record('#retailers public list', r.status === 200 && r.data.length >= 1, `count=${r.data.length}`);

  // note the newly created product id for post-run DB checks (delete leaves it removed)
  facts.push({ name: 'audit:products:audit_product_id', detail: String(newProductId) });

  // ---------- CLEANUP: delete the audit product + its inventory --------
  const delProd = await api('delete', `/products/${newProductId}`, { token: roles.supplier.token });
  record('#products delete', delProd.status === 200);
  const delCheck = await api('get', `/products/${newProductId}`);
  record('#products delete confirmed gone (404)', delCheck.status === 404);

  // summary
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(2); });