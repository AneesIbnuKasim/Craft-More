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
  storeTimezone: process.env.STORE_TIMEZONE ?? 'Asia/Kolkata',
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
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
