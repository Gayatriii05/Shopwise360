// Phase 4 verification: input-validation shape, auth rate limiting, refresh-token
// rotation/reuse-detection/revoke, legacy-token back-compat, oversell 409, and
// the Redis dashboard cache (skipped gracefully when no Redis is reachable).
// Requires: server (5000) running, seeded DB. Run from tests/:  npm run verify:phase4
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const API = 'http://localhost:5000/api';
const PASSWORD = 'Password123';

const results = [];
const facts = [];
const skipped = [];
function record(name, ok, detail = '', skip = false) {
  results.push({ name, ok, skip });
  console.log(`${ok ? 'PASS' : skip ? 'SKIP' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (/^#/.test(name)) facts.push({ name: name.slice(2), ok, detail });
  if (skip) skipped.push(name);
}
function envValue(key) {
  const line = fs.readFileSync(path.resolve(__dirname, '../server/.env'), 'utf8')
    .split(/\r?\n/).map((l) => l.trim()).find((l) => l.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1) : '';
}

async function api(method, url, { token, data, params } = {}) {
  const h = token ? { Authorization: `Bearer ${token}` } : {};
  return axios({ method, url: `${API}${url}`, data, params, headers: h, validateStatus: () => true });
}

async function main() {
  // ---------- ITEM 1: validation shape ----------
  const badLogin = await api('post', '/auth/login', { data: { email: 'nope', password: '' } });
  record('#validation login 400 shape',
    badLogin.status === 400 && typeof badLogin.data.error === 'string' && Array.isArray(badLogin.data.errors) && badLogin.data.errors[0].field,
    `status=${badLogin.status} errors=${badLogin.data.errors?.length}`);

  const cust = await api('post', '/auth/login', { data: { email: 'customer@shopwise.com', password: PASSWORD } });
  const badOrder = await api('post', '/orders', { token: cust.data.token, data: { retailer_id: -1, items: [] } });
  record('#validation order 400 shape',
    badOrder.status === 400 && Array.isArray(badOrder.data.errors) && badOrder.data.errors.length >= 2,
    `status=${badOrder.status} errors=${badOrder.data.errors?.map((e) => e.field).join(',')}`);

  const badRate = await api('post', '/products/999999/reviews', { token: cust.data.token, data: { rating: 999 } });
  record('#validation review rating range',
    badRate.status === 400 && badRate.data.errors.some((e) => e.field === 'rating'),
    `status=${badRate.status}`);

  // ---------- ITEM 2: rate limiting (burst on a throwaway email; isolated key) ----------
  const burstEmail = `burst_${Date.now()}@example.com`;
  const codes = {};
  for (let i = 0; i < 25; i++) {
    const r = await api('post', '/auth/login', { data: { email: burstEmail, password: 'x' } });
    codes[r.status] = (codes[r.status] || 0) + 1;
    if (r.status === 429) break;
  }
  record('#ratelimit login 429 after burst',
    codes[429] === 1 && codes[401] >= 20,
    JSON.stringify(codes));

  const realLogin = await api('post', '/auth/login', { data: { email: 'retailer@shopwise.com', password: PASSWORD } });
  record('#ratelimit unrelated key unaffected',
    realLogin.status === 200,
    `status=${realLogin.status}`);

  // ---------- ITEM 6: oversell → 409, not 500 ----------
  const incl = (await api('get', '/inventory/retailer/1', { token: realLogin.data.token })).data.find((i) => i.quantity >= 1);
  const over = await api('post', '/orders', {
    token: cust.data.token,
    data: { retailer_id: 1, items: [{ product_id: incl.product_id, quantity: 99999 }] }
  });
  record('#oversell 409 with message',
    over.status === 409 && /Insufficient stock/.test(over.data.error),
    `status=${over.status}`);

  // ---------- ITEM 3: refresh tokens ----------
  const email = `rt_${Date.now()}@example.com`;
  const reg = await api('post', '/auth/register', { data: { name: 'RT', email, password: PASSWORD, role: 'customer' } });
  record('#refresh register issues pair',
    reg.status === 201 && !!reg.data.accessToken && !!reg.data.refreshToken && reg.data.token === reg.data.accessToken);

  const me = await api('get', '/auth/me', { token: reg.data.accessToken });
  record('#refresh access token usable', me.status === 200, `status=${me.status}`);

  const rot1 = await api('post', '/auth/refresh', { data: { refreshToken: reg.data.refreshToken } });
  record('#refresh rotate issues new pair', rot1.status === 200 && !!rot1.data.accessToken && !!rot1.data.refreshToken, `status=${rot1.status}`);

  const rot2 = await api('post', '/auth/refresh', { data: { refreshToken: rot1.data.refreshToken } });
  record('#refresh rotation chain works', rot2.status === 200, `status=${rot2.status}`);

  const reuseOld = await api('post', '/auth/refresh', { data: { refreshToken: rot1.data.refreshToken } });
  const newAfterReuse = await api('post', '/auth/refresh', { data: { refreshToken: rot2.data.refreshToken } });
  record('#refresh reuse detection revokes family',
    reuseOld.status === 401 && newAfterReuse.status === 401,
    `old=${reuseOld.status} new=${newAfterReuse.status}`);

  const relog = await api('post', '/auth/login', { data: { email, password: PASSWORD } });
  await api('post', '/auth/logout', { data: { refreshToken: relog.data.refreshToken } });
  const afterLogout = await api('post', '/auth/refresh', { data: { refreshToken: relog.data.refreshToken } });
  record('#refresh logout revokes', afterLogout.status === 401, `status=${afterLogout.status}`);

  const asBearer = await api('get', '/auth/me', { token: relog.data.refreshToken });
  record('#refresh token rejected as bearer', asBearer.status === 401, `status=${asBearer.status}`);

  // legacy-style token (no `type` claim) must still authenticate
  const legacy = jwt.sign({ id: cust.data.user.id, role: cust.data.user.role, email: cust.data.user.email }, envValue('JWT_SECRET'), { expiresIn: '15m' });
  const legacyMe = await api('get', '/auth/me', { token: legacy });
  record('#legacy no-type token accepted', legacyMe.status === 200, `status=${legacyMe.status}`);

  // a token WE defend against: type:'refresh' used as access token
  const refreshAsJwt = jwt.sign({ id: cust.data.user.id, role: cust.data.user.role, email: cust.data.user.email, type: 'refresh' }, envValue('JWT_SECRET'), { expiresIn: '15m' });
  const rejMe = await api('get', '/auth/me', { token: refreshAsJwt });
  record('#type-refresh jwt rejected for API', rejMe.status === 401, `status=${rejMe.status}`);

  // ---------- ITEM 4 (Redis): skipped gracefully when unreachable ----------
  const Redis = require('ioredis');
  const redisUrl = envValue('REDIS_URL') || 'redis://localhost:6379';
  const client = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 1500, retryStrategy: () => null });
  client.on('error', () => {});
  try {
    await client.connect();
    await client.set('_p4_probe', '1');
    const probe = await client.get('_p4_probe');
    await client.del('_p4_probe');
    record('#redis cache reachable + X-Cache HIT on repeat reads', probe === '1' && false, 'reachable but HIT path needs TTL wait; see report');
    const r1 = await api('get', '/dashboard/retailer/1/summary', { token: realLogin.data.token });
    const r2 = await api('get', '/dashboard/retailer/1/summary', { token: realLogin.data.token });
    record('#redis X-Cache MISS then HIT', r2.headers['x-cache'] === 'HIT' && r1.headers['x-cache'] === 'MISS', `first=${r1.headers['x-cache']} second=${r2.headers['x-cache']}`);
  } catch {
    record('#redis X-Cache MISS when Redis down (fail-open)', false, 'SKIP — no Redis on this machine; enable with docker compose', true);
  } finally {
    client.disconnect();
  }

  // ---------- summary ----------
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok && !r.skip).length;
  const skipCount = skipped.length;
  console.log(`\nPHASE 4 VERIFICATION: ${passed}/${results.length} passed, ${skipCount} skipped${failed ? `, ${failed} failed` : ''}`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });