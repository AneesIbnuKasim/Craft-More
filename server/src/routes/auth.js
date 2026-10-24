import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { Owner } from '../models/Owner.js';
import { AppError, asyncHandler } from '../utils/http.js';
import { csrfToken, requireAuth, requireCsrf } from '../middleware/auth.js';

export const authRouter = Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: { code: 'LOGIN_RATE_LIMITED', message: 'Too many login attempts. Try again later.' } } });

authRouter.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const owner = await Owner.findOne({ email });
  if (!owner || !(await bcrypt.compare(password, owner.passwordHash))) throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  await new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
  req.session.ownerId = owner._id.toString();
  return res.json({ authenticated: true, email: owner.email });
}));

authRouter.get('/me', requireAuth, (req, res) => res.json({ authenticated: true, ownerId: req.ownerId }));
authRouter.get('/csrf', requireAuth, csrfToken);
authRouter.post('/logout', requireAuth, requireCsrf, asyncHandler(async (req, res) => {
  await new Promise((resolve, reject) => req.session.destroy((error) => error ? reject(error) : resolve()));
  res.clearCookie('craft_more.sid');
  return res.status(204).send();
}));
