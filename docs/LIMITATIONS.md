# Limitations and deployment considerations

This document distinguishes implemented behavior from guarantees the application does not make.

## Product and browser boundaries

- Rules and focus sessions record/remind; the web application does not block websites or native
  applications at the operating-system level.
- The Chrome extension only operates in supported browser contexts and active HTTP(S) tabs. It
  cannot run on browser-restricted pages, monitor other browsers, native desktop software, or
  mobile applications. Its page overlay is a reminder, not tamper-proof enforcement.
- The extension requires Chrome 102+ with permissions granted and the backend reachable. Network
  interruption can delay session reconciliation. Existing sessions started elsewhere are not
  adopted by the extension.
- Focus mode uses the shared server-side session API; starting another session is rejected while
  an open session exists for the account.

## Authentication and privacy

- The web client stores the bearer token in localStorage; any script executing in the origin can
  access it. Deploy only trusted frontend code, use HTTPS, and apply a suitable content security
  policy at the hosting layer.
- Logout increments an account-level token version, invalidating that account's issued tokens.
  It is not a per-device logout; logging out one client also invalidates other sessions for the
  same account.
- There is no password reset/email verification workflow or public account deletion endpoint.
- Administrator role provisioning uses a trusted one-off CLI and database access; the admin
  dashboard is read-only and cannot edit roles, delete accounts, or lock accounts.
- The backend has an in-memory login/register rate limiter. Multi-process deployments need
  deployment-appropriate shared rate-limit storage if coordinated limits are required.
- Configure production CORS to allow only the intended frontend origin, set strong secrets outside
  source control, and terminate TLS at a trusted deployment boundary.

## Data and integration boundaries

- MongoDB must be reachable for backend startup and private API features. `/api/health` reports
  current connection state; the endpoint is not a full dependency diagnostic.
- Analytics use available activity/session records and UTC periods. Missing, incomplete, or
  malformed source data cannot be reconstructed by the analytics layer.
- Admin overview session metrics include completed sessions only. They do not count active or
  paused sessions.
- The service has no background job queue, push-notification provider, or external mail delivery;
  notifications are in-app records.
- No automated deployment pipeline, backup/restore procedure, or production observability
  configuration is included in this workspace.

## Verification limits

Phase 16 automated results are recorded in [Testing and verification](TESTING.md). The recorded
suite uses mocks for database-bound business logic. A live MongoDB connection and health smoke
check succeeded, but full user workflows were not exercised against live records. Manual
authentication, admin, responsive/accessibility, theme persistence, and Chrome-extension browser
tests remain necessary before release.

At the last recorded dependency audit, backend runtime dependencies had no reported advisories.
The frontend lockfile reported advisories for Vite/esbuild and React Router. Audit suggested major
version upgrades; those upgrades were not applied or compatibility-tested. Re-run package-manager
audits at release time and review advisories against the deployed dependency tree.
