import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { authRouter } from './routes/auth.js';
import { customerRouter } from './routes/customers.js';
import { billRouter } from './routes/bills.js';
import { requireAuth, requireCsrf } from './middleware/auth.js';
import { AppError, errorHandler } from './utils/http.js';

export const createApp = ({ mongoUri = env.mongoUri, sessionStore, clientOrigin = env.clientOrigin } = {}) => {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.nodeEnv === 'production' ? 1 : 0);
  app.use(helmet());
  app.use(cors({ origin: clientOrigin, credentials: true }));
  app.use(express.json({ limit: '50kb' }));
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: 'draft-8', legacyHeaders: false }));
  app.use(session({
    name: 'craft_more.sid',
    secret: env.sessionSecret,
    store: sessionStore ?? MongoStore.create({ mongoUrl: mongoUri, ttl: 60 * 60 * 24 * 7 }),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { httpOnly: true, secure: env.nodeEnv === 'production', sameSite: env.nodeEnv === 'production' ? 'none' : 'lax', domain: env.cookieDomain, maxAge: 1000 * 60 * 60 * 24 * 7 }
  }));
  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRouter);
  app.use('/api', requireAuth, requireCsrf);
  app.use('/api/customers', customerRouter);
  app.use('/api/bills', billRouter);
  app.use((req, res, next) => next(new AppError(404, 'Route not found', 'NOT_FOUND')));
  app.use(errorHandler);
  return app;
};
