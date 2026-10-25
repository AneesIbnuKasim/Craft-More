import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { Bill } from '../models/Bill.js';
import { AuditRecord } from '../models/AuditRecord.js';
import { Counter } from '../models/Counter.js';
import { Customer } from '../models/Customer.js';
import { AppError } from '../utils/http.js';
import { monthKey, previousMonthKey } from '../utils/dates.js';
import { calculateBillAmounts, discountPercentageForEligiblePaise } from './discountService.js';

const pageSize = (value) => Math.min(Math.max(Number.parseInt(value ?? '20', 10) || 20, 1), 100);
const objectId = (value, label) => {
  if (!mongoose.isValidObjectId(value)) throw new AppError(400, `Invalid ${label}`, `INVALID_${label.toUpperCase()}_ID`);
  return new mongoose.Types.ObjectId(value);
};

const amount = (value, field) => {
  if (!Number.isInteger(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) throw new AppError(400, `${field} must be a non-negative integer number of paise`, 'INVALID_AMOUNT');
  return value;
};

const billDate = (value) => {
  const parsed = value === undefined ? new Date() : new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new AppError(400, 'billDate must be a valid date', 'INVALID_BILL_DATE');
  return parsed;
};

const validateIdempotencyKey = (value) => {
  if (typeof value !== 'string' || value.length < 8 || value.length > 128) throw new AppError(400, 'Idempotency-Key must be 8 to 128 characters', 'INVALID_IDEMPOTENCY_KEY');
  return value;
};

const requestHash = ({ customerId, billDate: date, eligibleProductAmount, excludedProductAmount }) => crypto.createHash('sha256').update(JSON.stringify({ customerId: String(customerId), billDate: date ? date.toISOString() : null, eligibleProductAmount, excludedProductAmount })).digest('hex');

const eligibilityFor = async (customerId, date, timeZone, excludeBillId) => {
  const previousMonth = previousMonthKey(date, timeZone);
  const match = { customerId, status: 'valid', reportingMonth: previousMonth };
  if (excludeBillId) match._id = { $ne: excludeBillId };
  const [result] = await Bill.aggregate([{ $match: match }, { $group: { _id: null, eligibleProductAmount: { $sum: '$eligibleProductAmount' } } }]);
  return { previousMonth, eligibleProductAmount: result?.eligibleProductAmount ?? 0, discountPercentage: discountPercentageForEligiblePaise(result?.eligibleProductAmount ?? 0) };
};

const nextBillNumber = async () => {
  const counter = await Counter.findOneAndUpdate({ _id: 'bill' }, { $inc: { sequence: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true });
  return `BILL-${String(counter.sequence).padStart(8, '0')}`;
};

const getCustomerOrFail = async (id) => {
  const customer = await Customer.findById(id);
  if (!customer) throw new AppError(404, 'Customer not found', 'CUSTOMER_NOT_FOUND');
  return customer;
};

export const createBill = async ({ customerId, billDate: rawDate, eligibleProductAmount: rawEligible, excludedProductAmount: rawExcluded, idempotencyKey }, timeZone) => {
  const customerObjectId = objectId(customerId, 'customer');
  const key = validateIdempotencyKey(idempotencyKey);
  const date = billDate(rawDate);
  const eligibleProductAmount = amount(rawEligible, 'eligibleProductAmount');
  const excludedProductAmount = amount(rawExcluded, 'excludedProductAmount');
  const hash = requestHash({ customerId: customerObjectId, billDate: rawDate === undefined ? null : date, eligibleProductAmount, excludedProductAmount });
  const existing = await Bill.findOne({ idempotencyKey: key });
  if (existing) {
    if (existing.requestHash !== hash) throw new AppError(409, 'Idempotency-Key was already used for a different bill', 'IDEMPOTENCY_KEY_REUSED');
    return { bill: existing, idempotent: true };
  }
  await getCustomerOrFail(customerObjectId);
  const eligibility = await eligibilityFor(customerObjectId, date, timeZone);
  const calculated = calculateBillAmounts({ eligibleProductAmount, excludedProductAmount, discountPercentage: eligibility.discountPercentage });
  const document = {
    billNumber: await nextBillNumber(), customerId: customerObjectId, billDate: date, reportingMonth: monthKey(date, timeZone),
    eligibleProductAmount, excludedProductAmount, ...calculated, discountPercentage: eligibility.discountPercentage, status: 'valid', idempotencyKey: key, requestHash: hash
  };
  try {
    const bill = await Bill.create(document);
    return { bill, idempotent: false, eligibility };
  } catch (error) {
    if (error?.code === 11000) {
      const concurrent = await Bill.findOne({ idempotencyKey: key });
      if (concurrent?.requestHash === hash) return { bill: concurrent, idempotent: true };
    }
    throw error;
  }
};

const dateFilter = (query, timeZone) => {
  const filter = {};
  if (query.month !== undefined || query.year !== undefined) {
    const month = Number(query.month); const year = Number(query.year);
    if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 1970 || year > 9999) throw new AppError(400, 'month and year must be valid', 'INVALID_DATE_FILTER');
    filter.reportingMonth = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
  }
  if (query.from || query.to) {
    filter.billDate = {};
    if (query.from) { const from = billDate(query.from); filter.billDate.$gte = from; }
    if (query.to) { const to = billDate(query.to); filter.billDate.$lte = to; }
  }
  return filter;
};

export const listBills = async (query, timeZone) => {
  const filter = dateFilter(query, timeZone);
  if (query.status) {
    if (!['valid', 'cancelled'].includes(query.status)) throw new AppError(400, 'Invalid bill status', 'INVALID_STATUS');
    filter.status = query.status;
  }
  if (query.billNumber) filter.billNumber = { $regex: `^${String(query.billNumber).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, $options: 'i' };
  if (query.customer) {
    const escaped = String(query.customer).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const customers = await Customer.find({ $or: [{ name: { $regex: escaped, $options: 'i' } }, { normalizedMobileNumber: { $regex: escaped.replace(/\D/g, ''), $options: 'i' } }] }).select('_id');
    filter.customerId = { $in: customers.map(({ _id }) => _id) };
  }
  const limit = pageSize(query.limit); const page = Math.max(Number.parseInt(query.page ?? '1', 10) || 1, 1);
  const [items, total] = await Promise.all([Bill.find(filter).populate('customerId', 'customerId name mobileNumber').sort({ billDate: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(), Bill.countDocuments(filter)]);
  return { items, page, limit, total };
};

export const getBill = async (id) => {
  const bill = await Bill.findById(objectId(id, 'bill')).populate('customerId', 'customerId name mobileNumber').lean();
  if (!bill) throw new AppError(404, 'Bill not found', 'BILL_NOT_FOUND');
  const audits = await AuditRecord.find({ billId: bill._id }).sort({ timestamp: -1 }).lean();
  return { ...bill, audits };
};

export const correctBill = async (id, changes, timeZone) => {
  const billId = objectId(id, 'bill');
  const current = await Bill.findById(billId);
  if (!current) throw new AppError(404, 'Bill not found', 'BILL_NOT_FOUND');
  if (current.status !== 'valid') throw new AppError(409, 'Cancelled bills cannot be corrected', 'BILL_NOT_ACTIVE');
  if (typeof changes?.reason !== 'string' || changes.reason.trim().length < 3) throw new AppError(400, 'A correction reason is required', 'REASON_REQUIRED');
  const date = billDate(changes.billDate ?? current.billDate);
  const eligibleProductAmount = amount(changes.eligibleProductAmount ?? current.eligibleProductAmount, 'eligibleProductAmount');
  const excludedProductAmount = amount(changes.excludedProductAmount ?? current.excludedProductAmount, 'excludedProductAmount');
  const eligibility = await eligibilityFor(current.customerId, date, timeZone, current._id);
  const calculated = calculateBillAmounts({ eligibleProductAmount, excludedProductAmount, discountPercentage: eligibility.discountPercentage });
  const updatedValues = { billDate: date, reportingMonth: monthKey(date, timeZone), eligibleProductAmount, excludedProductAmount, ...calculated, discountPercentage: eligibility.discountPercentage };
  const previousValues = { billDate: current.billDate, reportingMonth: current.reportingMonth, eligibleProductAmount: current.eligibleProductAmount, excludedProductAmount: current.excludedProductAmount, grossTotal: current.grossTotal, discountPercentage: current.discountPercentage, discountAmount: current.discountAmount, finalPayableAmount: current.finalPayableAmount };
  const updated = await Bill.findOneAndUpdate({ _id: billId, status: 'valid', updatedAt: current.updatedAt }, { $set: { ...updatedValues, updatedAt: new Date() } }, { new: true, runValidators: true });
  if (!updated) throw new AppError(409, 'Bill changed concurrently; reload and try again', 'CONCURRENT_BILL_UPDATE');
  await AuditRecord.create({ billId, actionType: 'correction', previousValues, updatedValues, reason: changes.reason.trim() });
  return getBill(id);
};

export const cancelBill = async (id, reason) => {
  const billId = objectId(id, 'bill');
  if (typeof reason !== 'string' || reason.trim().length < 3) throw new AppError(400, 'A cancellation reason is required', 'REASON_REQUIRED');
  const current = await Bill.findById(billId);
  if (!current) throw new AppError(404, 'Bill not found', 'BILL_NOT_FOUND');
  if (current.status === 'cancelled') throw new AppError(409, 'Bill is already cancelled', 'BILL_ALREADY_CANCELLED');
  const updated = await Bill.findOneAndUpdate({ _id: billId, status: 'valid', updatedAt: current.updatedAt }, { $set: { status: 'cancelled', updatedAt: new Date() } }, { new: true });
  if (!updated) throw new AppError(409, 'Bill changed concurrently; reload and try again', 'CONCURRENT_BILL_UPDATE');
  await AuditRecord.create({ billId, actionType: 'cancellation', previousValues: { status: 'valid' }, updatedValues: { status: 'cancelled' }, reason: reason.trim() });
  return getBill(id);
};

export const customerTotals = async (customerId, timeZone, now = new Date()) => {
  const currentMonth = monthKey(now, timeZone); const previousMonth = previousMonthKey(now, timeZone);
  const [result] = await Bill.aggregate([{ $match: { customerId, status: 'valid' } }, { $group: { _id: null, lifetimePurchases: { $sum: '$grossTotal' }, lifetimeDiscounts: { $sum: '$discountAmount' }, validBills: { $sum: 1 }, currentEligible: { $sum: { $cond: [{ $eq: ['$reportingMonth', currentMonth] }, '$eligibleProductAmount', 0] } }, previousEligible: { $sum: { $cond: [{ $eq: ['$reportingMonth', previousMonth] }, '$eligibleProductAmount', 0] } }, currentGross: { $sum: { $cond: [{ $eq: ['$reportingMonth', currentMonth] }, '$grossTotal', 0] } } } }]);
  return { currentMonth, previousMonth, previousMonthEligiblePurchases: result?.previousEligible ?? 0, currentMonthEligiblePurchases: result?.currentEligible ?? 0, currentMonthGrossPurchases: result?.currentGross ?? 0, lifetimePurchases: result?.lifetimePurchases ?? 0, lifetimeDiscounts: result?.lifetimeDiscounts ?? 0, validBills: result?.validBills ?? 0 };
};
