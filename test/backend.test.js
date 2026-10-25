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
const { Bill } = await import('../server/src/models/Bill.js');
const { AuditRecord } = await import('../server/src/models/AuditRecord.js');
const { discountPercentageForEligiblePaise, calculateBillAmounts } = await import('../server/src/services/discountService.js');
const { previousMonthKey } = await import('../server/src/utils/dates.js');
const bcrypt = await import('bcryptjs');

let mongo;
let app;
let agent;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await connectDatabase(mongo.getUri());
  await Promise.all([Customer.init(), Bill.init(), AuditRecord.init(), Owner.init()]);
  await Owner.create({ email: 'owner@example.com', passwordHash: await bcrypt.hash('correct-horse-battery-staple', 10) });
  app = createApp({ mongoUri: mongo.getUri(), sessionStore: new session.MemoryStore() });
  agent = request.agent(app);
});

beforeEach(async () => {
  await Promise.all([Customer.deleteMany({}), Bill.deleteMany({}), AuditRecord.deleteMany({})]);
});

after(async () => {
  await disconnectDatabase();
  await mongo.stop();
});

test('discount thresholds use exact paise boundaries', () => {
  assert.equal(discountPercentageForEligiblePaise(149999), 0);
  assert.equal(discountPercentageForEligiblePaise(150000), 8);
  assert.equal(discountPercentageForEligiblePaise(249999), 8);
  assert.equal(discountPercentageForEligiblePaise(250000), 12);
  assert.equal(discountPercentageForEligiblePaise(399999), 12);
  assert.equal(discountPercentageForEligiblePaise(400000), 15);
});

test('previous calendar month crosses the December to January boundary', () => {
  assert.equal(previousMonthKey(new Date('2027-01-02T02:00:00.000Z'), 'Asia/Kolkata'), '2026-12');
});

test('bill calculations discount eligible products only', () => {
  assert.deepEqual(calculateBillAmounts({ eligibleProductAmount: 200000, excludedProductAmount: 100000, discountPercentage: 12 }), { grossTotal: 300000, discountAmount: 24000, finalPayableAmount: 276000 });
});

test('private customer APIs reject unauthenticated requests', async () => {
  const response = await request(app).get('/api/customers');
  assert.equal(response.status, 401);
});

test('owner can login and register/search a normalized customer', async () => {
  const login = await agent.post('/api/auth/login').send({ email: 'owner@example.com', password: 'correct-horse-battery-staple' });
  assert.equal(login.status, 200);
  const csrf = await agent.get('/api/auth/csrf');
  assert.equal(csrf.status, 200);
  const created = await agent.post('/api/customers').set('X-CSRF-Token', csrf.body.csrfToken).send({ name: 'Anees', mobileNumber: '+91 98765 43210' });
  assert.equal(created.status, 201);
  assert.equal(created.body.customer.mobileNumber, '9876543210');
  const found = await agent.get('/api/customers/search?q=987654');
  assert.equal(found.status, 200);
  assert.equal(found.body.total, 1);
  assert.equal(found.body.items[0].name, 'Anees');
});

test('duplicate normalized mobile is rejected by the unique index', async () => {
  const csrf = (await agent.get('/api/auth/csrf')).body.csrfToken;
  const first = await agent.post('/api/customers').set('X-CSRF-Token', csrf).send({ name: 'First Customer', mobileNumber: '9876543210' });
  assert.equal(first.status, 201);
  const duplicate = await agent.post('/api/customers').set('X-CSRF-Token', csrf).send({ name: 'Second Customer', mobileNumber: '+91-9876543210' });
  assert.equal(duplicate.status, 409);
});

test('customer profile and purchase history return calculated totals', async () => {
  const csrf = (await agent.get('/api/auth/csrf')).body.csrfToken;
  const created = await agent.post('/api/customers').set('X-CSRF-Token', csrf).send({ name: 'History Customer', mobileNumber: '9876543211' });
  const id = created.body.customer.id;
  await Bill.create({ billNumber: 'BILL-1', customerId: id, billDate: new Date(), reportingMonth: '2026-10', eligibleProductAmount: 200000, excludedProductAmount: 50000, grossTotal: 250000, discountPercentage: 0, discountAmount: 0, finalPayableAmount: 250000, idempotencyKey: 'test-1-key', requestHash: 'test-hash' });
  const profile = await agent.get(`/api/customers/${id}`);
  assert.equal(profile.status, 200);
  assert.equal(profile.body.customer.lifetimePurchases, 250000);
  const history = await agent.get(`/api/customers/${id}/purchases?month=10&year=2026`);
  assert.equal(history.status, 200);
  assert.equal(history.body.total, 1);
});

test('bill creation uses the previous calendar month and preserves calculations', async () => {
  const csrf = (await agent.get('/api/auth/csrf')).body.csrfToken;
  const customer = await agent.post('/api/customers').set('X-CSRF-Token', csrf).send({ name: 'Bill Customer', mobileNumber: '9876543212' });
  const customerId = customer.body.customer.id;
  await Bill.create({ billNumber: 'BILL-PREVIOUS', customerId, billDate: new Date('2026-09-15T10:00:00+05:30'), reportingMonth: '2026-09', eligibleProductAmount: 250000, excludedProductAmount: 999999, grossTotal: 1249999, discountPercentage: 0, discountAmount: 0, finalPayableAmount: 1249999, idempotencyKey: 'previous-key', requestHash: 'previous-hash' });
  const created = await agent.post('/api/bills').set('X-CSRF-Token', csrf).set('Idempotency-Key', 'current-bill-key').send({ customerId, billDate: '2026-10-10T10:00:00+05:30', eligibleProductAmount: 200000, excludedProductAmount: 100000 });
  assert.equal(created.status, 201);
  assert.equal(created.body.bill.discountPercentage, 12);
  assert.equal(created.body.bill.grossTotal, 300000);
  assert.equal(created.body.bill.discountAmount, 24000);
  assert.equal(created.body.bill.finalPayableAmount, 276000);
  assert.equal(created.body.eligibility.previousMonth, '2026-09');
});

test('duplicate bill submissions are idempotent and current purchases do not change eligibility', async () => {
  const csrf = (await agent.get('/api/auth/csrf')).body.csrfToken;
  const customer = await agent.post('/api/customers').set('X-CSRF-Token', csrf).send({ name: 'Idempotent Customer', mobileNumber: '9876543213' });
  const body = { customerId: customer.body.customer.id, billDate: '2026-10-11T10:00:00+05:30', eligibleProductAmount: 450000, excludedProductAmount: 0 };
  const first = await agent.post('/api/bills').set('X-CSRF-Token', csrf).set('Idempotency-Key', 'same-bill-key').send(body);
  const retry = await agent.post('/api/bills').set('X-CSRF-Token', csrf).set('Idempotency-Key', 'same-bill-key').send(body);
  assert.equal(first.status, 201);
  assert.equal(retry.status, 200);
  assert.equal(retry.body.idempotent, true);
  assert.equal(await Bill.countDocuments({ idempotencyKey: 'same-bill-key' }), 1);
  const profile = await agent.get(`/api/customers/${body.customerId}`);
  assert.equal(profile.body.customer.discountPercentage, 0);
});

test('cancellation removes a bill from active totals and preserves audit history', async () => {
  const csrf = (await agent.get('/api/auth/csrf')).body.csrfToken;
  const customer = await agent.post('/api/customers').set('X-CSRF-Token', csrf).send({ name: 'Cancel Customer', mobileNumber: '9876543214' });
  const created = await agent.post('/api/bills').set('X-CSRF-Token', csrf).set('Idempotency-Key', 'cancel-bill-key').send({ customerId: customer.body.customer.id, eligibleProductAmount: 200000, excludedProductAmount: 50000 });
  const cancelled = await agent.post(`/api/bills/${created.body.bill._id}/cancel`).set('X-CSRF-Token', csrf).send({ reason: 'Entered in error' });
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.bill.status, 'cancelled');
  const profile = await agent.get(`/api/customers/${customer.body.customer.id}`);
  assert.equal(profile.body.customer.lifetimePurchases, 0);
  assert.equal(profile.body.customer.validBills, 0);
  const detail = await agent.get(`/api/bills/${created.body.bill._id}`);
  assert.equal(detail.body.bill.audits.length, 1);
  assert.equal(detail.body.bill.audits[0].actionType, 'cancellation');
});

test('correction recalculates the bill using the bill date eligibility and records an audit', async () => {
  const csrf = (await agent.get('/api/auth/csrf')).body.csrfToken;
  const customer = await agent.post('/api/customers').set('X-CSRF-Token', csrf).send({ name: 'Correction Customer', mobileNumber: '9876543215' });
  const created = await agent.post('/api/bills').set('X-CSRF-Token', csrf).set('Idempotency-Key', 'correction-bill-key').send({ customerId: customer.body.customer.id, billDate: '2026-10-12T10:00:00+05:30', eligibleProductAmount: 100000, excludedProductAmount: 50000 });
  const corrected = await agent.put(`/api/bills/${created.body.bill._id}`).set('X-CSRF-Token', csrf).send({ eligibleProductAmount: 150000, excludedProductAmount: 50000, reason: 'Corrected eligible amount' });
  assert.equal(corrected.status, 200);
  assert.equal(corrected.body.bill.discountPercentage, 0);
  assert.equal(corrected.body.bill.discountAmount, 0);
  assert.equal(corrected.body.bill.audits.length, 1);
  assert.equal(corrected.body.bill.audits[0].actionType, 'correction');
});

test('dashboard and report endpoints return database-derived results', async () => {
  const csrf = (await agent.get('/api/auth/csrf')).body.csrfToken;
  const customer = await agent.post('/api/customers').set('X-CSRF-Token', csrf).send({ name: 'Report Customer', mobileNumber: '9876543216' });
  const bill = await agent.post('/api/bills').set('X-CSRF-Token', csrf).set('Idempotency-Key', 'report-bill-key').send({ customerId: customer.body.customer.id, billDate: '2026-10-13T10:00:00+05:30', eligibleProductAmount: 200000, excludedProductAmount: 50000 });
  assert.equal(bill.status, 201);
  const dashboard = await agent.get('/api/dashboard/summary');
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.body.currentMonth.validBills, 1);
  const sales = await agent.get('/api/reports/monthly-sales?period=2026-10');
  assert.equal(sales.status, 200);
  assert.equal(sales.body.grossSales, 250000);
  const customers = await agent.get('/api/reports/customers?period=2026-10');
  assert.equal(customers.status, 200);
  assert.equal(customers.body.items.length, 1);
  const discounts = await agent.get('/api/reports/discounts?period=2026-10');
  assert.equal(discounts.status, 200);
  assert.equal(discounts.body.bills.length, 1);
});

test('two authenticated devices share data and concurrent idempotent bills stay consistent', async () => {
  const deviceA = request.agent(app);
  const deviceB = request.agent(app);
  await Promise.all([
    deviceA.post('/api/auth/login').send({ email: 'owner@example.com', password: 'correct-horse-battery-staple' }),
    deviceB.post('/api/auth/login').send({ email: 'owner@example.com', password: 'correct-horse-battery-staple' })
  ]);
  const [csrfA, csrfB] = await Promise.all([deviceA.get('/api/auth/csrf'), deviceB.get('/api/auth/csrf')]);
  const created = await deviceA.post('/api/customers').set('X-CSRF-Token', csrfA.body.csrfToken).send({ name: 'Shared Device Customer', mobileNumber: '9876543217' });
  assert.equal(created.status, 201);
  const visibleOnDeviceB = await deviceB.get('/api/customers/search?q=9876543217');
  assert.equal(visibleOnDeviceB.status, 200);
  assert.equal(visibleOnDeviceB.body.total, 1);
  const billBody = { customerId: created.body.customer.id, eligibleProductAmount: 150000, excludedProductAmount: 25000 };
  const responses = await Promise.all([
    deviceA.post('/api/bills').set('X-CSRF-Token', csrfA.body.csrfToken).set('Idempotency-Key', 'concurrent-device-bill').send(billBody),
    deviceB.post('/api/bills').set('X-CSRF-Token', csrfB.body.csrfToken).set('Idempotency-Key', 'concurrent-device-bill').send(billBody)
  ]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 201]);
  assert.equal(await Bill.countDocuments({ idempotencyKey: 'concurrent-device-bill' }), 1);
});
