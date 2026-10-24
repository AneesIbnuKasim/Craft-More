import crypto from 'node:crypto';
import { AppError } from '../utils/http.js';

export const requireAuth = (req, res, next) => {
  if (!req.session?.ownerId) return next(new AppError(401, 'Authentication required', 'UNAUTHENTICATED'));
  req.ownerId = req.session.ownerId;
  return next();
};

export const csrfToken = (req, res) => {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  return res.json({ csrfToken: req.session.csrfToken });
};

export const requireCsrf = (req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  const supplied = req.get('x-csrf-token');
  const expected = req.session?.csrfToken;
  if (!supplied || !expected || supplied.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    return next(new AppError(403, 'Invalid CSRF token', 'INVALID_CSRF_TOKEN'));
  }
  return next();
};
