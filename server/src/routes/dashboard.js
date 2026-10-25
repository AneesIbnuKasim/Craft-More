import { Router } from 'express';
import { env } from '../config/env.js';
import { asyncHandler } from '../utils/http.js';
import { dashboardSummary } from '../services/reportService.js';

export const dashboardRouter = Router();
dashboardRouter.get('/summary', asyncHandler(async (req, res) => res.json(await dashboardSummary(env.storeTimezone))));
