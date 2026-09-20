// Run with: npm run seed  (after schema.sql has been applied)
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function seed() {
  const conn = await pool.getConnection();
  try {
    console.log('Seeding categories...');
    await conn.query(`INSERT IGNORE INTO categories (id, name) VALUES
      (1,'Electronics'),(2,'Grocery'),(3,'Apparel'),(4,'Home & Kitchen'),(5,'Beauty')`);

    console.log('Seeding users (password for all: Password123)...');
    const hash = await bcrypt.hash('Password123', 10);
    const users = [
      ['Admin One', 'admin@shopwise.com', 'admin'],
      ['Sam Supplier', 'supplier@shopwise.com', 'supplier'],
      ['Rita Retailer', 'retailer@shopwise.com', 'retailer'],
      ['Chris Customer', 'customer@shopwise.com', 'customer'],
    ];
    const userIds = {};
    for (const [name, email, role] of users) {
      const [existing] = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
      if (existing.length) {
        userIds[role] = existing[0].id;
        continue;
      }
      const [result] = await conn.query(
        'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
        [name, email, hash, role]
      );
      userIds[role] = result.insertId;
    }

    console.log('Seeding supplier & retailer profiles...');
    let [supRows] = await conn.query('SELECT id FROM suppliers WHERE user_id = ?', [userIds.supplier]);
    let supplierId;
    if (!supRows.length) {
      const [r] = await conn.query('INSERT INTO suppliers (user_id, company_name, contact_phone) VALUES (?, ?, ?)',
        [userIds.supplier, 'Global Supplies Co', '9998887771']);
      supplierId = r.insertId;
    } else supplierId = supRows[0].id;

    let [retRows] = await conn.query('SELECT id FROM retailers WHERE user_id = ?', [userIds.retailer]);
    let retailerId;
    if (!retRows.length) {
      const [r] = await conn.query('INSERT INTO retailers (user_id, store_name, location) VALUES (?, ?, ?)',
        [userIds.retailer, 'Rita General Store', 'Nagpur, MH']);
      retailerId = r.insertId;
    } else retailerId = retRows[0].id;

    console.log('Seeding products...');
    const imgs = (id) => `https://images.unsplash.com/${id}?w=600&q=80&auto=format&fit=crop`;
    const products = [
      ['Wireless Mouse', 'Ergonomic 2.4GHz wireless mouse', 1, 300, 599, imgs('photo-1527864550417-7fd91fc51a46')],
      ['Bluetooth Speaker', 'Portable 10W speaker', 1, 800, 1499, imgs('photo-1608043152269-423dbba4e7e1')],
      ['Basmati Rice 5kg', 'Premium long-grain rice', 2, 400, 549, imgs('photo-1586201375761-83865001e31c')],
      ['Cotton T-Shirt', 'Unisex round neck tee', 3, 150, 399, imgs('photo-1576566588028-4147f3842f27')],
      ['Non-stick Pan', '26cm induction-friendly pan', 4, 350, 699, imgs('photo-1519751138087-5bf79df62d5b')],
      ['Face Wash 100ml', 'Herbal daily face wash', 5, 90, 199, imgs('photo-1556228578-8c89e6adf883')],
      ['Mechanical Keyboard', 'RGB backlit mechanical keyboard', 1, 1200, 2199, imgs('photo-1587829741301-dc798b83add3')],
      ['LED Desk Lamp', 'Adjustable brightness lamp', 4, 250, 499, imgs('photo-1507473885765-e6ed057f782c')],
    ];
    const productIds = [];
    for (const [name, desc, catId, cost, sale, imageUrl] of products) {
      const [existing] = await conn.query('SELECT id FROM products WHERE name = ?', [name]);
      if (existing.length) {
        await conn.query('UPDATE products SET image_url = ? WHERE id = ?', [imageUrl, existing[0].id]);
        productIds.push(existing[0].id); continue;
      }
      const [r] = await conn.query(
        'INSERT INTO products (name, description, category_id, supplier_id, cost_price, sale_price, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [name, desc, catId, supplierId, cost, sale, imageUrl]
      );
      productIds.push(r.insertId);
    }

    console.log('Seeding inventory...');
    const quantities = [50, 5, 100, 8, 30, 60, 3, 40];
    for (let i = 0; i < productIds.length; i++) {
      await conn.query(
        `INSERT INTO inventory (product_id, retailer_id, quantity, low_stock_threshold)
         VALUES (?, ?, ?, 10) ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)`,
        [productIds[i], retailerId, quantities[i]]
      );
    }

    console.log('Seeding historical orders/sales (for demand model training)...');
    const daysAgo = [20, 15, 10, 5, 18, 12, 8, 3, 25, 6];
    for (let i = 0; i < 10; i++) {
      const productId = productIds[i % productIds.length];
      const [[product]] = await conn.query('SELECT cost_price, sale_price FROM products WHERE id = ?', [productId]);
      const qty = 1 + (i % 3);
      const revenue = product.sale_price * qty;
      const profit = (product.sale_price - product.cost_price) * qty;

      const [orderResult] = await conn.query(
        'INSERT INTO orders (customer_id, retailer_id, status, total_amount, created_at) VALUES (?, ?, ?, ?, NOW() - INTERVAL ? DAY)',
        [userIds.customer, retailerId, 'delivered', revenue, daysAgo[i]]
      );
      await conn.query(
        'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
        [orderResult.insertId, productId, qty, product.sale_price]
      );
      await conn.query(
        'INSERT INTO sales_transactions (order_id, product_id, retailer_id, quantity, revenue, profit, sold_at) VALUES (?, ?, ?, ?, ?, ?, NOW() - INTERVAL ? DAY)',
        [orderResult.insertId, productId, retailerId, qty, revenue, profit, daysAgo[i]]
      );
    }

    console.log('Seeding sample reviews...');
    const reviewSpecs = [
      { productIdx: 0, rating: 4, comment: 'Great ergonomic mouse, battery lasts long.' },
      { productIdx: 1, rating: 5, comment: 'Impressive sound for the price.' },
      { productIdx: 2, rating: 4, comment: 'Aromatic and fluffy rice.' },
      { productIdx: 3, rating: 3, comment: 'Comfortable but shrinks after wash.' },
      { productIdx: 4, rating: 5, comment: 'Non-stick holds up really well.' },
      { productIdx: 5, rating: 4, comment: 'Gentle on my skin.' }
    ];
    for (const spec of reviewSpecs) {
      const productId = productIds[spec.productIdx];
      const [[orderIdRow]] = await conn.query(
        'SELECT oi.order_id FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE oi.product_id = ? AND o.customer_id = ? ORDER BY oi.id DESC LIMIT 1',
        [productId, userIds.customer]
      );
      if (orderIdRow) {
        await conn.query(
          'INSERT IGNORE INTO reviews (customer_id, product_id, order_id, rating, comment) VALUES (?, ?, ?, ?, ?)',
          [userIds.customer, productId, orderIdRow.order_id, spec.rating, spec.comment]
        );
      }
    }

    console.log('\n✅ Seed complete. Login with any of:');
    console.log('   admin@shopwise.com / Password123');
    console.log('   supplier@shopwise.com / Password123');
    console.log('   retailer@shopwise.com / Password123');
    console.log('   customer@shopwise.com / Password123');
  } catch (err) {
    console.error('Seed failed:', err);
  } finally {
    conn.release();
    process.exit(0);
  }
}

seed();
