import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase } from '../src/db.js';
import { env } from '../src/config/env.js';
import { Owner } from '../src/models/Owner.js';

if (!env.ownerEmail || !env.ownerPassword) throw new Error('OWNER_EMAIL and OWNER_PASSWORD are required for owner initialization');
if (env.ownerPassword.length < 12) throw new Error('OWNER_PASSWORD must be at least 12 characters');

await connectDatabase(env.mongoUri);
const existing = await Owner.exists({});
if (existing) throw new Error('An owner account already exists; initialization refused');
await Owner.create({ email: env.ownerEmail, passwordHash: await bcrypt.hash(env.ownerPassword, 12) });
console.log('Owner account initialized');
await disconnectDatabase();
