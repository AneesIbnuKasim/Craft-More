import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import session from 'express-session';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/craft-more-test';
process.env.SESSION_SECRET = 'test-session-secret-that-is-long-enough-123456';
process.env.STORE_TIMEZONE = 'Asia/Kolkata';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';

const { connectDatabase, disconnectDatabase } = await import('../server/src/db.js');
const { createApp } = await import('../server/src/app.js');
const { Owner } = await import('../server/src/models/Owner.js');
const { Customer } = await import('../server/src/models/Customer.js');
const { Product } = await import('../server/src/models/Product.js');
const { Bill } = await import('../server/src/models/Bill.js');
const bcrypt = await import('bcryptjs');

let mongo, app, agent, csrfToken;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await connectDatabase(mongo.getUri());
  await Promise.all([Customer.init(), Product.init(), Bill.init(), Owner.init()]);
  await Owner.create({ email: 'owner@example.com', passwordHash: await bcrypt.hash('correct-horse-battery-staple', 10) });
  app = createApp({ mongoUri: mongo.getUri(), sessionStore: new session.MemoryStore() });
  agent = request.agent(app);
  const login = await agent.post('/api/auth/login').send({ email: 'owner@example.com', password: 'correct-horse-battery-staple' });
  assert.equal(login.status, 200);
  const csrf = await agent.get('/api/auth/csrf');
  csrfToken = csrf.body.csrfToken;
});

after(async () => { await disconnectDatabase(); await mongo.stop(); });

beforeEach(async () => { await Promise.all([Customer.deleteMany({}), Product.deleteMany({}), Bill.deleteMany({})]); });

test('receipt uses special price', async () => {
  const cust = await agent.post('/api/customers').set('X-CSRF-Token', csrfToken).send({ name: 'Anees', mobileNumber: '9876543210' });
  const prod = await agent.post('/api/products').set('X-CSRF-Token', csrfToken).send({ name: 'Panda Light', sku: 'PL1', regularPricePaise: 20000, specialPricePaise: 15000, stock: 10, discountEligible: true });
  const bill = await agent.post('/api/bills').set('X-CSRF-Token', csrfToken).set('Idempotency-Key', '12345678').send({ customerId: cust.body.customer.id, eligibleProductAmount: 0, excludedProductAmount: 0, products: [{ productId: prod.body.product._id, quantity: 2 }] });
  assert.equal(bill.status, 201);
  const receipt = await agent.get(`/api/bills/${bill.body.bill._id}/receipt`);
  assert.equal(receipt.status, 200);
  assert.equal(receipt.body.receipt.items[0].specialPrice, 15000);
  assert.equal(receipt.body.receipt.items[0].amount, 30000);
});
