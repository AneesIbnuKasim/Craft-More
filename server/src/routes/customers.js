import { Router } from 'express';
import { asyncHandler } from '../utils/http.js';
import { env } from '../config/env.js';
import { createCustomer, getCustomer, getPurchaseHistory, searchCustomers } from '../services/customerService.js';

export const customerRouter = Router();

customerRouter.post('/', asyncHandler(async (req, res) => {
  const customer = await createCustomer(req.body ?? {});
  return res.status(201).json({ customer: await getCustomer(customer._id, env.storeTimezone) });
}));

customerRouter.get('/', asyncHandler(async (req, res) => res.json(await searchCustomers({ query: req.query.q, page: req.query, timeZone: env.storeTimezone }))));
customerRouter.get('/search', asyncHandler(async (req, res) => res.json(await searchCustomers({ query: req.query.q, page: req.query, timeZone: env.storeTimezone }))));
customerRouter.get('/:id/purchases', asyncHandler(async (req, res) => res.json(await getPurchaseHistory(req.params.id, req.query))));
customerRouter.get('/:id/discount-eligibility', asyncHandler(async (req, res) => {
  const customer = await getCustomer(req.params.id, env.storeTimezone);
  return res.json({ previousMonth: customer.previousMonth, previousMonthEligiblePurchases: customer.previousMonthEligiblePurchases, discountPercentage: customer.discountPercentage });
}));
customerRouter.get('/:id', asyncHandler(async (req, res) => res.json({ customer: await getCustomer(req.params.id, env.storeTimezone) })));
