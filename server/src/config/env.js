import 'dotenv/config';

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  mongoUri: required('MONGODB_URI'),
  sessionSecret: required('SESSION_SECRET'),
  sessionTtlDays: Number(process.env.SESSION_TTL_DAYS ?? 7),
  storeTimezone: process.env.STORE_TIMEZONE ?? 'Asia/Kolkata',
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  corsOrigins: (process.env.CORS_ORIGINS ?? process.env.CLIENT_ORIGIN ?? 'http://localhost:5173').split(',').map((origin) => origin.trim()).filter(Boolean),
  trustProxy: process.env.TRUST_PROXY === undefined ? (process.env.NODE_ENV === 'production' ? 1 : 0) : (Number.isNaN(Number(process.env.TRUST_PROXY)) ? process.env.TRUST_PROXY : Number(process.env.TRUST_PROXY)),
  cookieSecure: process.env.COOKIE_SECURE === undefined ? process.env.NODE_ENV === 'production' : process.env.COOKIE_SECURE === 'true',
  cookieSameSite: process.env.COOKIE_SAME_SITE ?? (process.env.NODE_ENV === 'production' ? 'none' : 'lax'),
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  ownerEmail: process.env.OWNER_EMAIL,
  ownerPassword: process.env.OWNER_PASSWORD
};

if (!Number.isInteger(env.port) || env.port < 1 || env.port > 65535) {
  throw new Error('PORT must be a valid TCP port');
}

if (env.sessionSecret.length < 32) {
  throw new Error('SESSION_SECRET must be at least 32 characters');
}

if (!Number.isInteger(env.sessionTtlDays) || env.sessionTtlDays < 1 || env.sessionTtlDays > 30) throw new Error('SESSION_TTL_DAYS must be between 1 and 30');
if (!['lax', 'strict', 'none'].includes(env.cookieSameSite)) throw new Error('COOKIE_SAME_SITE must be lax, strict, or none');
if (env.cookieSameSite === 'none' && !env.cookieSecure) throw new Error('COOKIE_SECURE must be true when COOKIE_SAME_SITE is none');
