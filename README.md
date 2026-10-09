# RESTIFY

**Use Technology. Take Control. Rest Better.**

RESTIFY is a digital wellbeing web application for recording screen-time sessions, configuring
rules and breaks, and reviewing progress. The project contains a React frontend, Express API,
MongoDB persistence, and an optional Chrome Manifest V3 extension. Browser rules are reminders
and tracking aids; they are not tamper-proof site or device blocking.

## Project map

| Path | Purpose |
|---|---|
| `frontend/` | React 18 single-page application (Vite) |
| `backend/` | Express API, Mongoose models, authentication, business logic, tests |
| `browser-extension/` | Optional Chrome 102+ Manifest V3 extension |
| `docs/` | Setup, API, architecture, data model, workflows, tests, and limitations |

## Quick start

1. Use a supported Node.js release and MongoDB deployment. Configure the backend using
   [`backend/.env.example`](backend/.env.example); see [local setup](docs/SETUP.md). Never
   commit or share `.env` files.
2. In one terminal, start the API:

   ```sh
   cd backend
   npm ci
   npm run dev
   ```

3. In another terminal, start the web app:

   ```sh
   cd frontend
   npm ci
   npm run dev
   ```

4. Open `http://localhost:5173`. The API health endpoint is
   `http://localhost:5000/api/health`.

The backend requires a reachable MongoDB URI and a random `JWT_SECRET` of at least 32 bytes.
The frontend defaults to `http://localhost:5000/api`; set `VITE_API_URL` at frontend build/dev
time to use a different API base.

## Implemented product areas

- Registration, login, user-owned rules, activity tracking, and pause-aware focus sessions.
- UTC-based analytics, daily/weekly goals, streaks, achievements, and daily challenges.
- In-app notifications, persisted theme/notification preferences, and a protected focus page.
- A read-only administrator overview and account directory protected by a server-stored role.
- Optional browser website monitoring for supported HTTP(S) tabs through the extension.

See [user flows](docs/USER_FLOW.md), the [API reference](docs/API_DOCUMENTATION.md), and
[extension guide](browser-extension/README.md) for actual behavior and limits.

## Documentation

- [Local setup, configuration, and admin provisioning](docs/SETUP.md)
- [HTTP API reference](docs/API_DOCUMENTATION.md)
- [Architecture and request/data flow](docs/ARCHITECTURE.md)
- [MongoDB models and indexes](docs/DATABASE_SCHEMA.md)
- [User workflows](docs/USER_FLOW.md)
- [Testing and recorded verification](docs/TESTING.md)
- [Limitations and deployment considerations](docs/LIMITATIONS.md)

## Development checks

```sh
cd backend && npm test
cd frontend && npm run build && node --test test/*.test.js
cd browser-extension && npm run check
```

The extension has no npm dependencies or lockfile; `npm run check` checks its JavaScript syntax
and runs its Node test suite. Manual loading in Chrome is still required to validate real browser
permissions, tab events, and content-script behavior.

## Phase status

Application implementation and verification work extends through Phase 16 (Testing + Security +
Final Verification); Phase 17 adds this documentation and final review without changing product
code. Phase 16's recorded automated results and remaining manual checks are in
[Testing and verification](docs/TESTING.md). These documents describe behavior confirmed in the
current source; they do not imply that manual browser/device tests or a deployment security review
have been completed.
