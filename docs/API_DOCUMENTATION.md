# RESTIFY HTTP API

The API is mounted at `/api`. Local default base URL: `http://localhost:5000/api`.
All request and response bodies use JSON unless otherwise noted.

## Authentication and response format

Private endpoints require `Authorization: Bearer <token>`. A successful response uses:

```json
{
  "success": true,
  "message": "Human-readable result.",
  "data": {}
}
```

An error response uses `success: false`, a safe `message`, and a machine-readable `code`;
validation errors may also include an `errors` array:

```json
{
  "success": false,
  "message": "Please correct the highlighted fields.",
  "code": "VALIDATION_ERROR",
  "errors": [{ "field": "email", "message": "Enter a valid email address." }]
}
```

The API does not include stack traces in error responses. The JSON body limit is 10 KB. Account
registration and login share a rate limiter of 10 unsuccessful attempts per 15 minutes; successful
requests are excluded from the limit.

## Health

| Method and path | Auth | Behavior |
|---|---|---|
| `GET /health` | No | Reports service status and MongoDB connection state; it does not expose credentials. |

## Authentication and profile

| Method and path | Auth | Behavior |
|---|---|---|
| `POST /auth/register` | No | Body: `name`, `email`, `password`. Name is at most 80 characters; email is normalized and validated; password is at least 8 characters and at most 72 UTF-8 bytes. Creates a regular user and returns `{ user, token }`. |
| `POST /auth/login` | No | Body: `email`, `password`. Returns `{ user, token }`; incorrect credentials use a generic 401 response. |
| `POST /auth/logout` | Yes | Increments the account's server-stored token version. All tokens issued to that account with the previous version are rejected; sign in again to continue. |
| `GET /auth/me` | Yes | Returns the current safe user profile. |
| `GET /users/me` | Yes | Returns the current safe user profile and preferences. |
| `PATCH /users/me/preferences` | Yes | Accepts one or both of `theme` (`system`, `light`, `dark`) and `notifications` (`achievements`, `challenges`, `goals`: booleans). Other fields are rejected. |

Example registration body:

```json
{
  "name": "Example User",
  "email": "user@example.test",
  "password": "replace-with-a-private-test-password"
}
```

The user response does not include a password hash or token-version value. Passwords are stored as
bcrypt hashes. JWTs are signed with the server secret and include an expiring subject, issuer,
audience, and token-version claim.

## Rules

All rule endpoints require authentication. Rule IDs and user ownership are checked on reads and
mutations.

| Method and path | Behavior |
|---|---|
| `POST /rules` | Creates a rule. |
| `GET /rules` | Lists the current user's rules. |
| `GET /rules/:id` | Gets one owned rule. |
| `PUT /rules/:id` | Updates one or more allowed fields on an owned rule. |
| `DELETE /rules/:id` | Deletes an owned rule. |
| `PATCH /rules/:id/toggle` | Toggles its enabled state. |

Create fields: `activity`, `timeLimit`, `action`, `message`, and `restDuration`; `target` is
required only for `Custom Website`. `enabled` may be supplied as a boolean. Time and rest limits
are whole minutes from 1 to 1440. Supported activities are `Instagram`, `YouTube`, `Facebook`,
`X`, `Netflix`, `Any Website`, and `Custom Website`. Supported actions are `blur`, `warning`,
`fullscreen_reminder`, `countdown`, `custom_message`, and `restriction`. Custom targets must be
domain names; they do not imply system-wide enforcement.

## Activity tracking and focus sessions

All endpoints require authentication. Activity/session queries are scoped to the authenticated
user. Durations are measured by the server and persisted in whole seconds.

| Method and path | Body | Behavior |
|---|---|---|
| `POST /activities/start` | `activity` required; optional `target` | Starts a tracked activity. |
| `POST /activities/stop` | None | Stops the caller's active activity. |
| `GET /activities` | None | Lists the caller's activity records. |
| `GET /activities/today` | None | Lists today's activity records using UTC day boundaries. |
| `POST /sessions/start` | Optional `ruleId` only | Starts a session, optionally snapshotting an owned enabled rule. Only one open session per user is allowed. |
| `GET /sessions` | None | Lists the caller's sessions. |
| `GET /sessions/active` | None | Returns the caller's active or paused session, or `null`. |
| `PATCH /sessions/:id/pause` | Optional `rest` boolean | Pauses an active session. `rest: true` starts the rule's configured rest only after its time limit is reached. |
| `PATCH /sessions/:id/resume` | None | Resumes a paused session; a configured rest must have elapsed. |
| `PATCH /sessions/:id/end` | None | Completes an active or paused session. |

Sessions move between `active`, `paused`, and `completed`. Paused time is not added to active
duration. Concurrent state changes may return `409 SESSION_STATE_CONFLICT`; clients should reload
the session before retrying.

## Analytics, goals, streaks, achievements, and challenges

All endpoints require authentication; analytics and user-specific records are derived/scoped to
the authenticated account. Analytics periods use UTC boundaries and avoid double-counting
overlapping activity and session intervals.

| Method and path | Behavior |
|---|---|
| `GET /analytics/today` | Today totals, activities, and daily breakdown. |
| `GET /analytics/weekly` | Current Monday-through-Sunday UTC week summary. |
| `GET /analytics/monthly` | Current UTC calendar month summary. |
| `GET /analytics/ranking` | Current-month activity ranking. |
| `GET /analytics/heatmap` | Daily totals for the last 30 UTC dates, including today. |
| `POST /goals` | Creates a goal with `period` (`daily` or `weekly`) and whole-minute `targetMinutes`. |
| `GET /goals` | Lists the caller's goals with derived progress. |
| `GET /goals/:id` | Gets one owned goal and progress. |
| `GET /goals/:id/progress` | Gets derived progress for one owned goal. |
| `PUT /goals/:id` | Updates allowed goal fields: `period`, `targetMinutes`, `isActive`. |
| `DELETE /goals/:id` | Deletes an owned goal. |
| `GET /streaks` | Returns the caller's current/longest qualifying streak and UTC metadata. |
| `GET /achievements` | Returns the caller's available and unlocked achievements. |
| `GET /challenges/today` | Returns the current daily challenge and completion state. |
| `POST /challenges/today/complete` | Records completion only when qualifying tracked activity/session data exists. |

Daily goal target range is 1–1440 minutes; weekly is 1–10080 minutes. Progress is calculated from
tracked records rather than client-provided durations.

## Notifications

All endpoints require authentication; mutations are restricted to the caller's notification
records. The list is the most recent 100 non-dismissed items and includes an unread count.

| Method and path | Behavior |
|---|---|
| `GET /notifications` | Returns `{ notifications, unreadCount }`. |
| `PATCH /notifications/read-all` | Marks all caller's visible unread notifications as read. |
| `PATCH /notifications/:id/read` | Marks an owned non-dismissed notification as read. |
| `DELETE /notifications/:id` | Dismisses an owned notification. |

## Administrator endpoints

All endpoints require both a valid user token and the server-stored `admin` role. Client-supplied
role values do not grant privileges.

| Method and path | Query | Behavior |
|---|---|---|
| `GET /admin/overview` | Optional `days` (default 30; 1–90) | Aggregate registered-user count, completed-session metrics for the selected UTC range, and database status. |
| `GET /admin/users` | `page` (default 1), `limit` (default 25; max 100), `search` (max 100 chars), `role` (`all`, `user`, `admin`) | Paginated searchable account metadata: ID, name, email, role, registration time. No password, preferences, tokens, or activity details. |

The dashboard is read-only. To promote an already-created account, use the trusted provisioning
script described in [setup](SETUP.md); there is no public role-promotion endpoint.
