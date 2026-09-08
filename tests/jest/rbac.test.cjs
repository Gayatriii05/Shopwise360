// Jest integration tests: ROLE-BASED ACCESS CONTROL (middleware guards).
// Verifies each protected route is reachable by the right role and blocked (401/403)
// by wrong roles. Runs against the LIVE server :5000.
const request = require('supertest');

const API = 'http://localhost:5000/api';
const PASSWORD = 'Password123';

let tokens = {};

beforeAll(async () => {
  for (const role of ['customer', 'retailer', 'supplier', 'admin']) {
    const res = await request(API).post('/auth/login')
      .send({ email: `${role}@shopwise.com`, password: PASSWORD });
    tokens[role] = { access: res.body.accessToken, user: res.body.user };
  }
});

const auth = (role) => `Bearer ${tokens[role].access}`;

describe('RBAC middleware guards', () => {
  test('no token -> 401 on protected route', async () => {
    const res = await request(API).get('/auth/me');
    expect(res.status).toBe(401);
  });

  test('customer can read own wishlist; seller/supplier/admin cannot hit customer wishlist add with bad role', async () => {
    // wishlist add is customer-only (201 on first add, 200 on idempotent re-add)
    const ok = await request(API).post('/wishlist').set('Authorization', auth('customer')).send({ product_id: 1 });
    const bad = await request(API).post('/wishlist').set('Authorization', auth('retailer')).send({ product_id: 1 });
    expect([200, 201]).toContain(ok.status);
    expect(bad.status).toBe(403);
  });

  test('products create is supplier/admin only (403 for customer, 201 for supplier)', async () => {
    const src = { name: 'RBAC Title', description: 'x', cost_price: 10, sale_price: 25, category_id: 1 };
    const asCustomer = await request(API).post('/products').set('Authorization', auth('customer')).field('name', src.name).field('cost_price', '10').field('sale_price', '25');
    const asSupplier = await request(API).post('/products').set('Authorization', auth('supplier')).field('name', src.name).field('cost_price', '10').field('sale_price', '25');
    expect(asCustomer.status).toBe(403);
    expect(asSupplier.status).toBe(201);
    // cleanup the created product
    const { execFileSync } = require('child_process');
    const fs = require('fs');
    const path = require('path');
    function envValue(k){const l=fs.readFileSync(path.resolve(__dirname,'../../server/.env'),'utf8').split(/\r?\n/).map(s=>s.trim()).find(s=>s.startsWith(k+'='));return l?l.slice(k.length+1):'';}
    if (asSupplier.body.id) {
      execFileSync(path.join('C:','Program Files','MySQL','MySQL Server 8.0','bin','mysql.exe'),
        ['-u', envValue('DB_USER')||'root', '-h', envValue('DB_HOST')||'localhost', envValue('DB_NAME')||'shopwise360', '-N','-B','-e', `DELETE FROM products WHERE id=${asSupplier.body.id}`],
        { env:{...process.env, MYSQL_PWD: envValue('DB_PASSWORD')}, encoding:'utf8' });
    }
  });

  test('inventory update is retailer/admin only (403 for supplier)', async () => {
    const inv = (await request(API).get('/inventory/retailer/1').set('Authorization', auth('retailer'))).body;
    const item = inv[0];
    const bad = await request(API).put(`/inventory/${item.id}`).set('Authorization', auth('supplier')).send({ quantity: 1, low_stock_threshold: 1 });
    expect(bad.status).toBe(403);
  });

  test('admin dashboard not visible to retailer (403)', async () => {
    const res = await request(API).get('/dashboard/admin/summary').set('Authorization', auth('retailer'));
    expect(res.status).toBe(403);
  });

  test('retailer dashboard visible to admin (200)', async () => {
    const res = await request(API).get('/dashboard/retailer/1/summary').set('Authorization', auth('admin'));
    expect(res.status).toBe(200);
  });

  test('orders place is customer-only (403 for retailer)', async () => {
    const res = await request(API).post('/orders').set('Authorization', auth('retailer'))
      .send({ retailer_id: 1, items: [{ product_id: 1, quantity: 1 }] });
    expect(res.status).toBe(403);
  });

  test('coupon validate is customer-only (403 for retailer)', async () => {
    const res = await request(API).post('/coupons/validate').set('Authorization', auth('retailer'))
      .send({ code: 'X', order_value: 10, retailer_id: 1 });
    expect(res.status).toBe(403);
  });

  test('coupon create is admin-only (403 for retailer)', async () => {
    const res = await request(API).post('/coupons').set('Authorization', auth('retailer'))
      .send({ code: `RB${Date.now()}`, discount_type: 'flat', discount_value: 5 });
    expect(res.status).toBe(403);
  });

  test('reports are retailer/admin only (403 for customer)', async () => {
    const res = await request(API).get('/reports/sales/csv').set('Authorization', auth('customer'));
    expect(res.status).toBe(403);
  });

  test('ml retrain is admin-only (403 for retailer)', async () => {
    const res = await request(API).post('/ml/retrain').set('Authorization', auth('retailer')).send({ target: 'all' });
    expect(res.status).toBe(403);
  });

  test('malformed JSON body -> 400 (global handler)', async () => {
    const res = await request(API).post('/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expect(res.status).toBe(400);
  });
});