import crypto from 'node:crypto';
import { Customer } from '../models/Customer.js';
import { Bill } from '../models/Bill.js';
import { AppError } from '../utils/http.js';
import { normalizeMobileNumber } from '../utils/mobile.js';
import { monthKey, previousMonthKey } from '../utils/dates.js';
import { discountPercentageForEligiblePaise } from './discountService.js';
import { customerTotals } from './billService.js';

const pageSize = (value) => Math.min(Math.max(Number.parseInt(value ?? '20', 10) || 20, 1), 100);

export const createCustomer = async ({ name, mobileNumber }) => {
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 120) throw new AppError(400, 'Customer name must be between 2 and 120 characters', 'INVALID_NAME');
  let normalized;
  try { normalized = normalizeMobileNumber(mobileNumber); } catch (error) { throw new AppError(400, error.message, 'INVALID_MOBILE_NUMBER'); }
  const customer = await Customer.create({
    customerId: `CUS-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    name: name.trim(),
    normalizedMobileNumber: normalized,
    mobileNumber: normalized
  });
  return customer;
};

const totalsFor = async (customerId, timeZone, now = new Date()) => {
  return customerTotals(customerId, timeZone, now);
};

export const serializeCustomer = async (customer, timeZone) => {
  const totals = await totalsFor(customer._id, timeZone);
  const previousEligible = totals.previousMonthEligiblePurchases;
  const discountPercentage = discountPercentageForEligiblePaise(previousEligible);
  return { id: customer._id, customerId: customer.customerId, name: customer.name, mobileNumber: customer.mobileNumber, registrationDate: customer.createdAt, discountPercentage, ...totals };
};

export const searchCustomers = async ({ query, page, timeZone }) => {
  const filter = {};
  if (query?.trim()) {
    const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [{ name: { $regex: escaped, $options: 'i' } }, { normalizedMobileNumber: { $regex: escaped.replace(/\D/g, ''), $options: 'i' } }];
  }
  const limit = pageSize(page?.limit);
  const currentPage = Math.max(Number.parseInt(page?.page ?? '1', 10) || 1, 1);
  const [customers, total] = await Promise.all([
    Customer.find(filter).sort({ name: 1 }).skip((currentPage - 1) * limit).limit(limit),
    Customer.countDocuments(filter)
  ]);
  return { items: await Promise.all(customers.map((customer) => serializeCustomer(customer, timeZone))), page: currentPage, limit, total };
};

export const getCustomer = async (id, timeZone) => {
  if (!/^[a-f\d]{24}$/i.test(String(id))) throw new AppError(400, 'Invalid customer ID', 'INVALID_CUSTOMER_ID');
  const customer = await Customer.findById(id);
  if (!customer) throw new AppError(404, 'Customer not found', 'CUSTOMER_NOT_FOUND');
  return serializeCustomer(customer, timeZone);
};

export const getPurchaseHistory = async (id, { month, year, page, limit }) => {
  if (!/^[a-f\d]{24}$/i.test(String(id))) throw new AppError(400, 'Invalid customer ID', 'INVALID_CUSTOMER_ID');
  if (!(await Customer.exists({ _id: id }))) throw new AppError(404, 'Customer not found', 'CUSTOMER_NOT_FOUND');
  const filter = { customerId: id };
  if (month && year) filter.reportingMonth = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
  const size = pageSize(limit);
  const currentPage = Math.max(Number.parseInt(page ?? '1', 10) || 1, 1);
  const [items, total] = await Promise.all([Bill.find(filter).sort({ billDate: -1 }).skip((currentPage - 1) * size).limit(size).lean(), Bill.countDocuments(filter)]);
  return { items, page: currentPage, limit: size, total };
};
