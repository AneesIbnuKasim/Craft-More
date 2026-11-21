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
const { Product } = await import('../server/src/models/Product.js');
const bcrypt = await import('bcryptjs');

let mongo, app, agent, csrfToken;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await connectDatabase(mongo.getUri());
  await Promise.all([Product.init(), Owner.init()]);
  await Owner.create({ email: 'owner@example.com', passwordHash: await bcrypt.hash('correct-horse-battery-staple', 10) });
  app = createApp({ mongoUri: mongo.getUri(), sessionStore: new session.MemoryStore() });
  agent = request.agent(app);
  const login = await agent.post('/api/auth/login').send({ email: 'owner@example.com', password: 'correct-horse-battery-staple' });
  assert.equal(login.status, 200);
  const csrf = await agent.get('/api/auth/csrf');
  csrfToken = csrf.body.csrfToken;
});

after(async () => { await disconnectDatabase(); await mongo.stop(); });

beforeEach(async () => { await Product.deleteMany({}); });

test('label uses special price', async () => {
  const prod = await agent.post('/api/products').set('X-CSRF-Token', csrfToken).send({ name: 'Panda Light', sku: 'PL1', regularPricePaise: 20000, specialPricePaise: 15000, stock: 10 });
  const label = await agent.get(`/api/products/${prod.body.product._id}/label`);
  assert.equal(label.status, 200);
  assert.equal(label.body.label.specialPricePaise, 15000);
  assert.equal(label.body.label.storeName, 'CRAFT & MORE');
});

test('batch labels', async () => {
  const prod = await agent.post('/api/products').set('X-CSRF-Token', csrfToken).send({ name: 'Pipe', sku: 'P2', specialPricePaise: 8000, stock: 10 });
  const res = await agent.post('/api/products/labels').set('X-CSRF-Token', csrfToken).send({ items: [{ productId: prod.body.product._id, quantity: 3 }] });
  assert.equal(res.status, 200);
  assert.equal(res.body.labels.length, 3);
});

test('invalid product label', async () => {
  const res = await agent.get('/api/products/507f1f77bcf86cd799439011/label');
  assert.equal(res.status, 404);
});
