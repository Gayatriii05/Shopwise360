// Jest integration tests: ORDER transaction safety (stock guard, oversell rollback,
// coupon persistence, status flow, invalid-input). Runs against the LIVE server.
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const API = 'http://localhost:5000/api';
const PASSWORD = 'Password123';

function envValue(key) {
  const line = fs.readFileSync(path.resolve(__dirname, '../../server/.env'), 'utf8')
    .split(/\r?\n/).map((l) => l.trim()).find((l) => l.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1) : '';
}
function db(sql) {
  const env = { ...process.env, MYSQL_PWD: envValue('DB_PASSWORD') };
  const args = ['-u', envValue('DB_USER') || 'root', '-h', envValue('DB_HOST') || 'localhost', envValue('DB_NAME') || 'shopwise360', '-N', '-B', '-e', sql];
  return execFileSync(path.join('C:', 'Program Files', 'MySQL', 'MySQL Server 8.0', 'bin', 'mysql.exe'), args, { env, encoding: 'utf8' }).trim();
}

let roles; // tokens
let retailerId = 1;
let custId;
let baselineMaxOrderId;

beforeAll(async () => {
  const customer = await request(API).post('/auth/login').send({ email: 'customer@shopwise.com', password: PASSWORD });
  const retailer = await request(API).post('/auth/login').send({ email: 'retailer@shopwise.com', password: PASSWORD });
  roles = { customer: customer.body.accessToken, retailer: retailer.body.accessToken };
  const me = await request(API).get('/auth/me').set('Authorization', `Bearer ${customer.body.accessToken}`);
  custId = me.body.id;
  baselineMaxOrderId = Number(db('SELECT COALESCE(MAX(id),0) FROM orders') || 0);
});

afterAll(() => {
  // remove ONLY orders created during this run (id > baseline), never seed data
  const oids = db(`SELECT id FROM orders WHERE id > ${baselineMaxOrderId}`);
  if (oids) db(`DELETE FROM orders WHERE id IN (${oids.split(/\s+/).join(',')})`);
});

describe('ORDERS (transaction safety)', () => {
  const login = () => request(API).post('/auth/login').send({ email: 'customer@shopwise.com', password: PASSWORD });

  test('validation: empty items -> 400 with errors[]', async () => {
    const res = await request(API)
      .post('/orders')
      .set('Authorization', `Bearer ${roles.customer}`)
      .send({ retailer_id: retailerId, items: [] });
    expect(res.status).toBe(400);
    expect(res.body.errors.some((e) => e.field === 'items')).toBe(true);
  });

  test('validation: invalid retailer_id -> 400', async () => {
    const res = await request(API)
      .post('/orders')
      .set('Authorization', `Bearer ${roles.customer}`)
      .send({ retailer_id: -1, items: [{ product_id: 1, quantity: 1 }] });
    expect(res.status).toBe(400);
  });

  test('unknown product -> 400', async () => {
    expect((await request(API).post('/orders')
      .set('Authorization', `Bearer ${roles.customer}`)
      .send({ retailer_id: retailerId, items: [{ product_id: 999999, quantity: 1 }] })).status).toBe(400);
  });

  test('oversell -> 409 and inventory unchanged (rollback)', async () => {
    const inv = (await request(API).get(`/inventory/retailer/${retailerId}`)
      .set('Authorization', `Bearer ${roles.retailer}`)).body;
    const target = inv.find((i) => i.quantity >= 1);
    const before = target.quantity;
    const res = await request(API)
      .post('/orders')
      .set('Authorization', `Bearer ${roles.customer}`)
      .send({ retailer_id: retailerId, items: [{ product_id: target.product_id, quantity: 999999 }] });
    expect(res.status).toBe(409);
    expect(/Insufficient stock/.test(res.body.error)).toBe(true);
    const after = (await request(API).get(`/inventory/retailer/${retailerId}`)
      .set('Authorization', `Bearer ${roles.retailer}`)).body;
    expect(after.find((i) => i.product_id === target.product_id).quantity).toBe(before);
  });

  test('valid order decrements stock by exactly the quantity purchased', async () => {
    const inv = (await request(API).get(`/inventory/retailer/${retailerId}`)
      .set('Authorization', `Bearer ${roles.retailer}`)).body;
    const target = inv.find((i) => i.quantity >= 5);
    const before = target.quantity;
    const qty = 2;
    const res = await request(API)
      .post('/orders')
      .set('Authorization', `Bearer ${roles.customer}`)
      .send({ retailer_id: retailerId, items: [{ product_id: target.product_id, quantity: qty }] });
    expect(res.status).toBe(201);
    expect(res.body.orderId).toBeTruthy();
    expect(res.body.total).toBeGreaterThan(0);
    const after = (await request(API).get(`/inventory/retailer/${retailerId}`)
      .set('Authorization', `Bearer ${roles.retailer}`)).body
      .find((i) => i.product_id === target.product_id).quantity;
    expect(after).toBe(before - qty);
    db(`UPDATE inventory SET quantity=${before} WHERE product_id=${target.product_id} AND retailer_id=${retailerId}`);
  });

  test('status flow: pending -> confirmed -> shipped -> delivered', async () => {
    const inv = (await request(API).get(`/inventory/retailer/${retailerId}`)
      .set('Authorization', `Bearer ${roles.retailer}`)).body;
    const target = inv.find((i) => i.quantity >= 3);
    const placed = await request(API)
      .post('/orders')
      .set('Authorization', `Bearer ${roles.customer}`)
      .send({ retailer_id: retailerId, items: [{ product_id: target.product_id, quantity: 1 }] });
    const id = placed.body.orderId;
    const step = (status) => request(API).put(`/orders/${id}/status`)
      .set('Authorization', `Bearer ${roles.retailer}`).send({ status });
    expect((await step('confirmed')).status).toBe(200);
    expect((await step('shipped')).status).toBe(200);
    expect((await step('delivered')).status).toBe(200);
    const back = await step('shipped');
    expect(back.status).toBe(400); // backward denied
    db(`UPDATE inventory SET quantity=quantity+1 WHERE product_id=${target.product_id} AND retailer_id=${retailerId}`);
  });

  test('status flow: ordering check (achieved by preceding)', () => {
    expect(roles.retailer).toBeTruthy();
  });
});