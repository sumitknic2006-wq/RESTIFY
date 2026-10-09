# Project context

RESTIFY is a personal digital-wellbeing tracker with:

- A React/Vite web application for account access, rules, dashboard analytics, goals,
  achievements, notifications, preferences, and focus sessions.
- An Express/Mongoose API that owns authentication, validation, user scoping, session timing,
  aggregation, and administrator authorization.
- An optional Chrome Manifest V3 extension that tracks eligible active browser tabs against
  enabled rules and displays time-limit/rest reminders.

The backend is the source of truth for user identity, roles, session duration/state, and persisted
preferences. Frontend route guards improve navigation but do not replace backend authorization.
The browser extension similarly relies on the API for authenticated rules and session data.

Application implementation and verification coverage in this workspace extends through Phase
16. Phase 17 adds documentation and a final review without changing application code. See the
root README for developer entry points and [Testing and verification](TESTING.md) for the
recorded evidence and remaining checks. Documentation makes no claim of native-app blocking,
production deployment readiness, or security certification.

For route contracts see [API documentation](API_DOCUMENTATION.md); for persisted fields see
[database schema](DATABASE_SCHEMA.md); for supported workflows see [user flow](USER_FLOW.md).
