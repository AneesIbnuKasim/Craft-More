# Craft More Store Desk

Craft More is a secure customer, discount, billing, audit, dashboard, and reporting system for a craft and retail shop.

Recommended production architecture:

```text
Mobile phones / laptop
          │ HTTPS + credentialed requests
          ▼
Hosted React/Vite frontend ─────► Hosted Node/Express API
                                      │
                                      ├── MongoDB Atlas
                                      └── MongoDB-backed sessions
```

The frontend never stores authoritative customer or billing data. The API calculates discounts and totals from MongoDB records.

## Requirements

- Node.js 20 or newer
- MongoDB for local development, or MongoDB Atlas for production
- HTTPS in production

## Local development

From the repository root:

```bash
npm install
npm install --prefix client
cp .env.example .env
npm run init-owner
npm start
```

In another terminal:

```bash
npm run dev --prefix client -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173`. Do not open `client/index.html` directly as a `file://` URL.

For local development, use `COOKIE_SECURE=false`, `COOKIE_SAME_SITE=lax`, and `CLIENT_ORIGIN=http://127.0.0.1:5173`.

## Environment variables

Copy `.env.example` to `.env` for local use. Never commit `.env`.

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | `development`, `test`, or `production` |
| `PORT` | API listening port |
| `MONGODB_URI` | MongoDB or MongoDB Atlas connection string |
| `SESSION_SECRET` | Random secret of at least 32 characters |
| `SESSION_TTL_DAYS` | Persistent session lifetime, 1–30 days |
| `STORE_TIMEZONE` | One store timezone, for example `Asia/Kolkata` |
| `CLIENT_ORIGIN` | Primary exact frontend origin |
| `CORS_ORIGINS` | Comma-separated exact allowed frontend origins |
| `TRUST_PROXY` | Number of trusted reverse-proxy hops, normally `1` in production |
| `COOKIE_SECURE` | Must be `true` over HTTPS |
| `COOKIE_SAME_SITE` | Use `none` for separate frontend/API origins over HTTPS; `lax` locally |
| `COOKIE_DOMAIN` | Optional cookie domain; leave empty unless required |
| `OWNER_EMAIL` | Used only by the one-time owner initialization command |
| `OWNER_PASSWORD` | Used only by the one-time owner initialization command |

The Vite client reads `VITE_API_BASE_URL` at build time. Copy `client/.env.example` to `client/.env` locally or set it in the frontend hosting provider.

## MongoDB Atlas setup

1. Create an Atlas project and production cluster.
2. Create a database user with a strong generated password.
3. Restrict network access to the API host where possible.
4. Put the Atlas connection string in the API host’s `MONGODB_URI` secret.
5. Use a replica-set-capable Atlas deployment for production transactions and availability.
6. Validate indexes during release checks.

## Production deployment

Use a Node-compatible API host and a static frontend host. The exact provider is intentionally not hardcoded.

### API host

Set these production variables in the provider’s secret/environment configuration:

```env
NODE_ENV=production
PORT=4000
MONGODB_URI=<MongoDB Atlas connection string>
SESSION_SECRET=<new random secret, 32+ characters>
SESSION_TTL_DAYS=7
STORE_TIMEZONE=Asia/Kolkata
CLIENT_ORIGIN=https://<your-frontend-domain>
CORS_ORIGINS=https://<your-frontend-domain>
TRUST_PROXY=1
COOKIE_SECURE=true
COOKIE_SAME_SITE=none
COOKIE_DOMAIN=
```

Start command:

```bash
npm start
```

Terminate TLS at the hosting provider or reverse proxy and forward HTTPS traffic to Node. `TRUST_PROXY=1` is correct for one trusted proxy hop; increase it only when the real topology requires it.

### One-time owner initialization

Set `OWNER_EMAIL` and `OWNER_PASSWORD` as temporary API-host secrets, then run:

```bash
npm run init-owner
```

The command refuses to overwrite an existing owner and is not exposed as an API endpoint. Remove the temporary password variable after initialization if the hosting platform allows it. The same owner can log in from multiple devices; each device receives its own persistent server-side session.

### Frontend host

Set the build-time variable:

```env
VITE_API_BASE_URL=https://<your-api-domain>/api
```

Build and publish `client/dist`:

```bash
npm run build --prefix client
```

Configure the static host to serve `client/dist/index.html` as the fallback for application routes. Frontend and API must both use HTTPS. Credentialed CORS and `SameSite=None; Secure` cookies are required when they use different origins.

## Authentication and security

- Passwords are bcrypt-hashed and never returned.
- Sessions are stored in MongoDB through `connect-mongo`, not browser storage.
- Session cookies are HTTP-only and configurable for secure cross-origin use.
- Private APIs require an authenticated session and state-changing APIs require CSRF tokens.
- Login attempts are rate limited.
- CORS allows only configured exact origins.
- Helmet security headers are enabled.
- No credentials or secrets are included in the frontend.
- Billing is online-only; the service worker never caches `/api` responses.

## Backups and recovery

Use MongoDB Database Tools from a secure backup environment. Keep backups encrypted and restrict access.

Create a compressed archive:

```bash
mongodump --uri "$MONGODB_URI" --archive="craft-more-$(date +%Y%m%d-%H%M%S).archive.gz" --gzip
```

Restore into a selected target after confirming the URI and taking a safety backup:

```bash
mongorestore --uri "$RESTORE_MONGODB_URI" --archive="craft-more-backup.archive.gz" --gzip --drop
```

Do not use `--drop` against production without an approved recovery procedure. Test restoration into a non-production Atlas database and verify customers, bills, audit records, indexes, and owner login. Enable Atlas automated backups and point-in-time recovery according to the selected Atlas tier.

## Testing and verification

```bash
npm test
npm run build --prefix client
```

The automated suite covers discount thresholds, calendar boundaries, authentication, duplicate customers, bill calculations, idempotency, corrections, cancellations, reports, shared multi-device sessions, and concurrent bill submissions. The PWA shell is installable after production build; billing still requires a live API connection.

## Deployment checklist

- [ ] Atlas cluster, user, network access, and backups configured
- [ ] Production `MONGODB_URI` stored as a provider secret
- [ ] Strong unique `SESSION_SECRET` stored as a secret
- [ ] HTTPS enabled for frontend and API
- [ ] `TRUST_PROXY` matches the reverse-proxy topology
- [ ] `CLIENT_ORIGIN` and `CORS_ORIGINS` match the exact frontend origin
- [ ] `COOKIE_SECURE=true` and `COOKIE_SAME_SITE=none` configured for separate origins
- [ ] Owner initialized once with `npm run init-owner`
- [ ] Temporary owner initialization password removed
- [ ] Frontend built with the correct `VITE_API_BASE_URL`
- [ ] Static-host SPA fallback configured
- [ ] `npm test` passes
- [ ] Frontend production build passes
- [ ] Login tested from two devices or browser profiles
- [ ] Customer and bill created on one device verified on another after refresh
- [ ] Correction and cancellation audit history verified
- [ ] Backup restore drill completed in non-production

No deployment has been performed by this repository preparation. The owner must create the hosting, Atlas, DNS, and HTTPS accounts and provide provider-specific secrets through secure environment configuration.
