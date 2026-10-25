import { Router } from 'express';
import { env } from '../config/env.js';
import { asyncHandler } from '../utils/http.js';
import { customerReport, discountReport, monthlySalesReport } from '../services/reportService.js';

export const reportRouter = Router();
reportRouter.get('/monthly-sales', asyncHandler(async (req, res) => res.json(await monthlySalesReport(req.query, env.storeTimezone))));
reportRouter.get('/customers', asyncHandler(async (req, res) => res.json(await customerReport(req.query, env.storeTimezone))));
reportRouter.get('/discounts', asyncHandler(async (req, res) => res.json(await discountReport(req.query, env.storeTimezone))));
