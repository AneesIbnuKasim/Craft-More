import { Router } from 'express';
import { env } from '../config/env.js';
import { asyncHandler } from '../utils/http.js';
import { cancelBill, correctBill, createBill, getBill, listBills } from '../services/billService.js';

export const billRouter = Router();

billRouter.post('/', asyncHandler(async (req, res) => {
  const result = await createBill({ ...req.body, idempotencyKey: req.get('idempotency-key') ?? req.body?.idempotencyKey }, env.storeTimezone);
  return res.status(result.idempotent ? 200 : 201).json({ bill: result.bill, idempotent: result.idempotent, eligibility: result.eligibility });
}));
billRouter.get('/', asyncHandler(async (req, res) => res.json(await listBills(req.query, env.storeTimezone))));
billRouter.get('/:id', asyncHandler(async (req, res) => res.json({ bill: await getBill(req.params.id) })));
billRouter.put('/:id', asyncHandler(async (req, res) => res.json({ bill: await correctBill(req.params.id, req.body, env.storeTimezone) })));
billRouter.post('/:id/cancel', asyncHandler(async (req, res) => res.json({ bill: await cancelBill(req.params.id, req.body?.reason) })));
