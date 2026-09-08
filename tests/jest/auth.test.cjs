// Jest integration tests: AUTH + RATE LIMITING + VALIDATION + REFRESH TOKENS.
// Runs against the LIVE server on :5000 (start server first), same as verify-*.
const fs = require('fs');
const path = require('path');
const request = require('supertest');

const API = 'http://localhost:5000/api';
const PASSWORD = 'Password123';

// Burst count derives from the configured AUTH_RATE_MAX so the check stays
// correct whatever the dev .env sets it to.
function authMax() {
  const line = fs.readFileSync(path.resolve(__dirname, '../../server/.env'), 'utf8')
    .split(/\r?\n/).map((l) => l.trim()).find((l) => l.startsWith('AUTH_RATE_MAX='));
  return line ? parseInt(line.slice('AUTH_RATE_MAX='.length), 10) : 20;
}

describe('AUTH', () => {
  const uniq = `jest_${Date.now()}@test.com`;

  test('register returns access + refresh pair and user', async () => {
    const res = await request(API)
      .post('/auth/register')
      .send({ name: 'Jest User', email: uniq, password: 'secret123', role: 'customer' });
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.token).toBe(res.body.accessToken); // legacy alias kept
    expect(res.body.user.email).toBe(uniq);
  });

  test('register duplicate email -> 409', async () => {
    const res = await request(API)
      .post('/auth/register')
      .send({ name: 'Jest User', email: uniq, password: 'secret123', role: 'customer' });
    expect(res.status).toBe(409);
  });

  test('login success returns pair', async () => {
    const res = await request(API)
      .post('/auth/login')
      .send({ email: uniq, password: 'secret123' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
  });

  test('login wrong password -> 401', async () => {
    const res = await request(API)
      .post('/auth/login')
      .send({ email: uniq, password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  test('validation: malformed login returns 400 with errors[]', async () => {
    const res = await request(API).post('/auth/login').send({ email: 'nope', password: '' });
    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe('string');
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  test('refresh token rotates to a new pair', async () => {
    const login = await request(API).post('/auth/login').send({ email: uniq, password: 'secret123' });
    const first = login.body.refreshToken;
    const rot = await request(API).post('/auth/refresh').send({ refreshToken: first });
    expect(rot.status).toBe(200);
    expect(rot.body.accessToken).toBeTruthy();
    expect(rot.body.refreshToken).not.toBe(first);
  });

  test('reused refresh token triggers reuse detection (revoke all)', async () => {
    const login = await request(API).post('/auth/login').send({ email: uniq, password: 'secret123' });
    const r1 = login.body.refreshToken;
    await request(API).post('/auth/refresh').send({ refreshToken: r1 }); // rotates r1
    const reuse = await request(API).post('/auth/refresh').send({ refreshToken: r1 });
    expect(reuse.status).toBe(401);
  });

  test('logout revokes the refresh token', async () => {
    const login = await request(API).post('/auth/login').send({ email: uniq, password: 'secret123' });
    const rt = login.body.refreshToken;
    const out = await request(API).post('/auth/logout').send({ refreshToken: rt });
    expect(out.status).toBe(200);
    const after = await request(API).post('/auth/refresh').send({ refreshToken: rt });
    expect(after.status).toBe(401);
  });

  test('access token authenticates /auth/me', async () => {
    const login = await request(API).post('/auth/login').send({ email: uniq, password: 'secret123' });
    const me = await request(API).get('/auth/me').set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(uniq);
  });

  test('refresh token rejected as API bearer (401)', async () => {
    const login = await request(API).post('/auth/login').send({ email: uniq, password: 'secret123' });
    const me = await request(API).get('/auth/me').set('Authorization', `Bearer ${login.body.refreshToken}`);
    expect(me.status).toBe(401);
  });

  test('rate limiting: login after burst (max+1) -> 429', async () => {
    const email = `burst_${Date.now()}@example.com`;
    const limit = authMax() + 1;
    let last = null;
    for (let i = 0; i < limit + 1; i++) {
      last = await request(API).post('/auth/login').send({ email, password: 'x' });
      if (last.status === 429) break;
    }
    expect(last.status).toBe(429);
  });

  test('rate limiting: distinct email key unaffected', async () => {
    const res = await request(API)
      .post('/auth/login')
      .send({ email: 'customer@shopwise.com', password: PASSWORD });
    expect(res.status).toBe(200);
  });
});