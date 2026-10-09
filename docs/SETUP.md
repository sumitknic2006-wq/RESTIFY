# Local setup and configuration

## Requirements

- Node.js and npm compatible with the checked-in backend/frontend dependencies.
- A reachable MongoDB deployment (MongoDB Atlas or another supported MongoDB server).
- Chrome 102+ only if testing the optional unpacked extension.

The repository has separate backend and frontend package manifests/lockfiles. The extension has
no npm dependencies or lockfile.

## Configure the backend

From the project root:

```sh
cp backend/.env.example backend/.env
```

Edit `backend/.env` locally. Do not paste its values into issue reports or commit it. Required:

| Variable | Required | Meaning |
|---|---:|---|
| `MONGODB_URI` | Yes | MongoDB connection URI. Keep credentials private. |
| `JWT_SECRET` | Yes | Random signing secret of at least 32 bytes. |

Optional settings (defaults shown):

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `5000` | Backend listen port; if busy, the server retries on the next port. |
| `JWT_EXPIRES_IN` | `1h` | `jsonwebtoken` expiration duration for access tokens. |
| `CLIENT_URL` | `http://localhost:5173` | Allowed frontend CORS origin. |
| `NODE_ENV` | `development` | Enables development-only localhost:5174 CORS origin when set to `development`. |
| `VITE_API_URL` | `http://localhost:5000/api` | Frontend build/dev API base URL. Set in the frontend environment when needed. |

`VITE_API_URL` is read by Vite in the frontend process/build; it is not a backend `.env` setting
unless explicitly exported to that process.

## Install and run

Terminal 1:

```sh
cd backend
npm ci
npm run dev
```

Terminal 2:

```sh
cd frontend
npm ci
npm run dev
```

Open `http://localhost:5173`; verify API reachability at `http://localhost:5000/api/health`.
Backend startup validates JWT configuration and waits for MongoDB. A connection failure prevents
the API from starting.

Production build and local preview:

```sh
cd frontend
npm run build
npm run preview
```

Run backend tests with `cd backend && npm test`. Run frontend timer tests with
`cd frontend && node --test test/*.test.js`. Run extension static checks/tests with
`cd browser-extension && npm run check`.

## Browser extension

See [browser-extension/README.md](../browser-extension/README.md) for Chrome installation,
permissions, sign-in, and supported-site boundaries. The default local API/dashboard URLs are
`http://localhost:5000/api` and `http://localhost:5173/dashboard`. Remote servers must use HTTPS.

## Provision an administrator

1. Create the intended account through the normal registration flow and confirm its identity
   before granting administrator access. The application does not provide email verification.
2. In a trusted environment with backend configuration and database access, run from `backend/`:

   ```sh
   node scripts/promote-admin.js user@example.test
   ```

   Replace the example with the exact account email. The script updates only that existing
   account. Never put database credentials in command-line arguments or commit them.
3. Sign in again after promotion so the client profile reflects the current stored role.

There is no public role-promotion endpoint. Restrict access to this script and to the database
configuration.

## Production checklist

- Use HTTPS for the frontend, API, and extension API target.
- Set a high-entropy `JWT_SECRET` (at least 32 bytes) in a deployment secret manager.
- Set `CLIENT_URL` to the exact production frontend origin and review CORS behavior.
- Restrict MongoDB network access and database privileges.
- Review current dependency audit output; do not upgrade across major versions without compatibility
  testing.
- Follow remaining manual checks in [Testing and verification](TESTING.md) and
  [Limitations](LIMITATIONS.md).
