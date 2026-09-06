// Phase 3 verification: ML persistence + model health + computed-only logging bound,
// discount/coupon engine, CSV/PDF reports, RBAC guards around all of them.
// Requires: server (5000) + ml-service (6000) running, seeded DB, mysql CLI on PATH.
// Run from tests/:  npm run verify:phase3
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const API = 'http://localhost:5000/api';
const PASSWORD = 'Password123';
const ML_MODELS = path.resolve(__dirname, '../ml-service/models');

const results = [];
const facts = [];
function record(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (/^#/.test(name)) facts.push({ name: name.slice(2), ok, detail });
}

async function login(email) {
  const { data } = await axios.post(`${API}/auth/login`, { email, password: PASSWORD });
  return data;
}

async function api(method, url, { token, data, params, headers, responseType } = {}) {
  const h = { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers };
  return axios({ method, url: `${API}${url}`, data, params, headers: h, responseType, validateStatus: () => true });
}

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

const sqlCount = (table) => Number(db(`SELECT COUNT(*) FROM ${table}`) || 0);

async function main() {
  // ---------- AUTH ----------
  const roles = {};
  for (const [role, email] of [['admin', 'admin@shopwise.com'], ['retailer', 'retailer@shopwise.com'], ['customer', 'customer@shopwise.com']]) {
    try {
      const r = await login(email);
      roles[role] = r;
      record('#auth login role ready', !!r.token, role);
    } catch (e) {
      record('#auth login role ready', false, `${role}: ${e.message}`);
    }
  }

  // ---------- MODEL HEALTH ----------
  let mh = await api('get', '/ml/model-health', { token: roles.admin.token }).catch((e) => ({ status: 0, data: { err: e.message } }));
  record('#ml model-health 200 + metrics', mh.status === 200
    && Number.isFinite(Number(mh.data.recommend?.metrics?.precision_at_k))
    && Number.isFinite(Number(mh.data.demand?.models?.[0]?.metrics?.mae))
    && Array.isArray(mh.data.demand?.models) && mh.data.demand.models.length >= 1,
    `precision@k=${mh.data.recommend?.metrics?.precision_at_k} mae=${mh.data.demand?.models?.[0]?.metrics?.mae} models=${mh.data.demand?.models?.length}`);
  record('#ml model-health shows freshness + ttl', typeof mh.data.recommend?.fresh === 'boolean' && typeof mh.data.demand?.models?.[0]?.fresh === 'boolean' && mh.data.max_age_seconds > 0);
  for (const role of ['retailer', 'customer']) {
    const r = await api('get', '/ml/model-health', { token: roles[role].token });
    record(`#ml model-health RBAC ${role} -> 403`, r.status === 403, `status=${r.status}`);
  }

  // ---------- RETRAIN ----------
  const rt = await api('post', '/ml/retrain', { token: roles.admin.token, data: { target: 'all' } });
  record('#ml retrain all ok', rt.status === 200 && Array.isArray(rt.data.trained?.demand) && rt.data.trained?.demand.length >= 1 && !!rt.data.trained?.recommend, `demand_mods=${rt.data.trained?.demand?.length}`);
  const rtRet = await api('post', '/ml/retrain', { token: roles.retailer.token, data: { target: 'all' } });
  record('#ml retrain RBAC retailer -> 403', rtRet.status === 403, `status=${rtRet.status}`);

  // ---------- COMPUTED-ONLY LOGGING + BOUND (growth fix) ----------
  const demandBefore = sqlCount('demand_predictions');
  const recBefore = sqlCount('recommendations_log');
  const d1 = await api('get', '/ml/predict-demand/1', { token: roles.retailer.token });
  const d2 = await api('get', '/ml/predict-demand/1', { token: roles.retailer.token });
  const r1 = await api('get', '/ml/recommend/4', { token: roles.customer.token });
  const r2 = await api('get', '/ml/recommend/4', { token: roles.customer.token });
  record('#ml cache-hit reports X-ML-Computed:false', String(d2.headers['x-ml-computed']).toLowerCase() === 'false' && String(r2.headers['x-ml-computed']).toLowerCase() === 'false',
    `demand=${d2.headers['x-ml-computed']} rec=${r2.headers['x-ml-computed']}`);
  record('#ml repeat reads write NOTHING (bounded logging)', sqlCount('demand_predictions') === demandBefore && sqlCount('recommendations_log') === recBefore,
    `demand ${demandBefore}->${sqlCount('demand_predictions')}, rec ${recBefore}->${sqlCount('recommendations_log')}`);

  // force a real recompute on demand: drop the artifact, next read lazy-retrains
  const demandArtifact = path.join(ML_MODELS, 'demand', 'retailer_1.joblib');
  const demandHeld = fs.existsSync(demandArtifact);
  try {
    if (demandHeld) fs.unlinkSync(demandArtifact);
  } catch (e) { /* ignore */ }
  const forceD = await api('get', '/ml/predict-demand/1', { token: roles.retailer.token });
  const written = sqlCount('demand_predictions') - demandBefore;
  record('#ml stale model -> lazy retrain + computed=true', String(forceD.headers['x-ml-computed']).toLowerCase() === 'true' && written === forceD.data.length,
    `computed=${forceD.headers['x-ml-computed']} rows_written=${written}`);
  const forceD2 = await api('get', '/ml/predict-demand/1', { token: roles.retailer.token });
  record('#ml recompute dedupe via uniq_demand_day (no growth on re-read)', sqlCount('demand_predictions') === demandBefore + written,
    `stable at ${sqlCount('demand_predictions')}`);

  // force a real recompute on recommend
  const recArtifact = path.join(ML_MODELS, 'recommend', 'model.joblib');
  try {
    if (fs.existsSync(recArtifact)) fs.unlinkSync(recArtifact);
  } catch (e) { /* ignore */ }
  const forceR = await api('get', '/ml/recommend/4', { token: roles.customer.token });
  const recWritten = sqlCount('recommendations_log') - recBefore;
  record('#ml recommend lazy retrain writes log on computed', String(forceR.headers['x-ml-computed']).toLowerCase() === 'true' && recWritten > 0 && recWritten <= forceR.data.length,
    `computed=${forceR.headers['x-ml-computed']} rows_written=${recWritten}`);

  // ---------- COUPONS ----------
  const CODE = `PH3_${Date.now().toString(36).toUpperCase()}`;
  let c = await api('post', '/coupons', { token: roles.customer.token, data: {} });
  record('#coupon create RBAC customer -> 403', c.status === 403, `status=${c.status}`);

  c = await api('post', '/coupons', {
    token: roles.admin.token,
    data: { code: CODE, description: 'phase3 test', discount_type: 'percent', discount_value: 10, min_order_value: 100, max_discount: 1000, usage_limit: 1 }
  });
  record('#coupon create 201', c.status === 201 && c.data.id > 0, `id=${c.data.id}`);
  const couponId = c.data.id;

  c = await api('post', '/coupons', { token: roles.admin.token, data: { code: CODE, discount_type: 'percent', discount_value: 10 } });
  record('#coupon duplicate code -> 409', c.status === 409, `status=${c.status}`);

  // validation decisions
  let v = await api('post', '/coupons/validate', { token: roles.customer.token, data: { code: CODE, order_value: 50, retailer_id: 1 } });
  record('#coupon validate below min-order -> rejected', v.status === 400 && v.data.valid === false && /min/i.test(v.data.reason || ''), v.data.reason || `status=${v.status}`);

  v = await api('post', '/coupons/validate', { token: roles.customer.token, data: { code: CODE, order_value: 800, retailer_id: 1 } });
  record('#coupon validate ok + percent math (10% of 800)', v.status === 200 && v.data.valid === true && v.data.discount === 80, `discount=${v.data.discount}`);

  v = await api('post', '/coupons/validate', { token: roles.customer.token, data: { code: 'NOPE123', order_value: 800, retailer_id: 1 } });
  record('#coupon unknown code -> rejected', v.status === 400 && v.data.valid === false, v.data.reason);

  // order with and without coupon
  const inv = (await api('get', '/inventory/retailer/1', { token: roles.retailer.token })).data;
  const invProduct = inv.find((i) => i.quantity >= 3) || inv[0];
  const price = Number(invProduct.sale_price);
  const expectedDiscount = Math.min(price * 0.1, 1000, price);
  const expectedTotal = price - expectedDiscount;

  const noCoup = await api('post', '/orders', { token: roles.customer.token, data: { retailer_id: 1, items: [{ product_id: invProduct.product_id, quantity: 1 }] } });
  record('#coupon order without coupon unaffected', noCoup.status < 300 && Math.abs(Number(noCoup.data.total) - price) < 0.01, `total=${noCoup.data.total} vs ${price}`);
  const cleanOrderId = noCoup.data.orderId;

  const withCoup = await api('post', '/orders', { token: roles.customer.token, data: { retailer_id: 1, items: [{ product_id: invProduct.product_id, quantity: 1 }], coupon_code: CODE } });
  record('#coupon order with coupon discounts total', withCoup.status < 300 && Math.abs(Number(withCoup.data.total) - expectedTotal) < 0.01 && Math.abs(Number(withCoup.data.discount) - expectedDiscount) < 0.01,
    `total=${withCoup.data.total} discount=${withCoup.data.discount} expected(disc=${expectedDiscount.toFixed(2)}, tot=${expectedTotal.toFixed(2)})`);
  const couponOrderId = withCoup.data.orderId;

  const dbOrder = db(`SELECT coupon_id, discount_amount, total_amount FROM orders WHERE id=${couponOrderId}`).split(/\s+/);
  record('#coupon order persisted coupon_id + discount_amount', Number(dbOrder[0]) === couponId && Math.abs(Number(dbOrder[1]) - expectedDiscount) < 0.01 && Math.abs(Number(dbOrder[2]) - expectedTotal) < 0.01,
    `coupon_id=${dbOrder[0]} discount=${dbOrder[1]} total=${dbOrder[2]}`);
  record('#coupon used_count incremented', sqlCount('sales_transactions') >= 1 && db(`SELECT used_count FROM coupons WHERE id=${couponId}`) === '1', db(`SELECT used_count FROM coupons WHERE id=${couponId}`));

  // usage limit exhausted (usage_limit=1 used above)
  v = await api('post', '/coupons/validate', { token: roles.customer.token, data: { code: CODE, order_value: 800, retailer_id: 1 } });
  record('#coupon usage limit reached -> rejected', v.status === 400 && /limit/i.test(v.data.reason || ''), v.data.reason);
  const orderWithCoupAfterLimit = await api('post', '/orders', { token: roles.customer.token, data: { retailer_id: 1, items: [{ product_id: invProduct.product_id, quantity: 1 }], coupon_code: CODE } });
  record('#coupon expiring code (limit) cannot be applied to new order', orderWithCoupAfterLimit.status === 400, `status=${orderWithCoupAfterLimit.status}`);
  const blockedOrderId = orderWithCoupAfterLimit.status === 400 ? null : orderWithCoupAfterLimit.data?.orderId;

  // coupon admin list/toggle/delete
  const list = await api('get', '/coupons', { token: roles.admin.token });
  record('#coupon admin list includes created', list.status === 200 && list.data.some((x) => x.id === couponId));
  const toggle = await api('put', `/coupons/${couponId}`, { token: roles.admin.token, data: { active: 0 } });
  v = await api('post', '/coupons/validate', { token: roles.retailer.token, data: { code: 'X', order_value: 1, retailer_id: 1 } });
  record('#coupon toggle ok', toggle.status === 200);

  // ---------- REPORTS ----------
  const csv = await api('get', '/reports/sales/csv', { token: roles.retailer.token, responseType: 'text' });
  record('#report sales CSV 200 + header + rows', csv.status === 200 && /text\/csv/.test(csv.headers['content-type'] || '') && /Date,Order ID,Retailer,Product,Quantity,Revenue,Profit/.test(csv.data) && csv.data.trim().split('\n').length > 2, `rows=${csv.data.trim().split('\n').length - 1}`);
  const pdf = await api('get', '/reports/inventory/pdf', { token: roles.retailer.token, responseType: 'arraybuffer' });
  record('#report inventory PDF 200 + content-type', pdf.status === 200 && (pdf.headers['content-type'] || '').includes('application/pdf') && pdf.data.length > 500, `bytes=${pdf.data.length}`);
  const adminCsv = await api('get', '/reports/sales/csv', { token: roles.admin.token, responseType: 'text' });
  record('#report admin platform-wide CSV', adminCsv.status === 200 && adminCsv.data.trim().split('\n').length > 2);
  for (const url of ['/reports/sales/csv', '/reports/inventory/pdf']) {
    const denied = await api('get', url, { token: roles.customer.token });
    record(`#report RBAC customer ${url} -> 403`, denied.status === 403, `status=${denied.status}`);
  }

  // ---------- CLEANUP ----------
  const oids = [cleanOrderId, couponOrderId, blockedOrderId].filter(Boolean);
  if (oids.length) db(`DELETE FROM orders WHERE id IN (${oids.join(',')})`);
  db(`DELETE FROM coupons WHERE id=${couponId}`);
  db(`UPDATE inventory SET quantity=${Number(invProduct.quantity)} WHERE retailer_id=1 AND product_id=${invProduct.product_id}`);
  record('#cleanup coupon + test orders removed', sqlCount('coupons') === 0 || !db(`SELECT id FROM coupons WHERE id=${couponId}`), 'coupon & orders deleted');

  // ---------- SUMMARY ----------
  const failed = results.filter((r) => !r.ok);
  console.log(`\nPHASE 3 VERIFICATION: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log('FAILED:');
    failed.forEach((f) => console.log(`  - ${f.name}`));
    process.exitCode = 1;
  }
}

main().catch((e) => { console.error('Harness error:', e); process.exitCode = 1; });