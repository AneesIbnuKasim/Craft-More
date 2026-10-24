import { createApp } from './app.js';
import { connectDatabase } from './db.js';
import { env } from './config/env.js';

await connectDatabase(env.mongoUri);
const app = createApp();
app.listen(env.port, () => console.log(`Craft More API listening on port ${env.port}`));
