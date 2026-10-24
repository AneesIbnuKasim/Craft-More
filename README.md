# Craft More

Backend foundation for the Craft and Shop Store Discount Management System.

## Setup

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env` and set a strong `SESSION_SECRET` and `MONGODB_URI`.
3. Run `npm install`.
4. Initialize the one owner account with `npm run init-owner`.
5. Start the API with `npm run dev` or `npm start`.

The owner initialization command reads `OWNER_EMAIL` and `OWNER_PASSWORD`, hashes the password, and refuses to overwrite an existing owner. It is not exposed as an HTTP endpoint.

Run tests with `npm test`. Tests use an isolated in-memory MongoDB instance and do not create records in the configured database.

## API

Public endpoints: `POST /api/auth/login`, `GET /api/health`.

After login, request `GET /api/auth/csrf` and send the returned token as `X-CSRF-Token` on state-changing requests. Private endpoints include customer registration/search/profile/history and authentication session endpoints.

In production, serve the API over HTTPS, set `NODE_ENV=production`, use a hosted MongoDB replica set or Atlas deployment, configure `CLIENT_ORIGIN` to the exact frontend origin, and use a strong randomly generated session secret.
