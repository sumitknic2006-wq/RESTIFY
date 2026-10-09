# Database schema

RESTIFY uses MongoDB through Mongoose. User-owned documents include a `user` ObjectId reference;
service queries must continue to include the authenticated user's ID. Most schemas use Mongoose
timestamps (`createdAt`, `updatedAt`). Duration values are whole seconds unless noted.

## Collections

| Model | Important fields | Integrity and indexes |
|---|---|---|
| `User` | `name`, normalized unique `email`, bcrypt `password`, `role` (`user`/`admin`), private `tokenVersion`, `preferences.theme`, `preferences.notifications` | Password and token version are excluded by default; JSON/object serialization also removes them and `__v`. Role defaults to `user`; preferences default to system theme and enabled notification categories. |
| `Rule` | `user`, `activity`, optional `target`, `timeLimit`, `action`, `message`, `restDuration`, `enabled` | User/creation-time index. Limits are whole minutes, 1–1440. Custom target is a validated domain. |
| `Activity` | `user`, `activity`, optional `target`, `startTime`, `endTime`, `durationSeconds`, UTC-day `date` | User/start-time index; partial unique user index permits one open activity per user. |
| `Session` | `user`, optional `ruleId` and `ruleSnapshot`, start/end, `status`, resume/pause history, active `durationSeconds`, rest start/end | User/status/start-time index; unique sparse index on `activeOwner` enforces one open session per user; optimistic concurrency protects transitions. |
| `Goal` | `user`, `period` (`daily`/`weekly`), `targetMinutes`, `isActive`, `targetHistory` | User/period/update-time index. Goal progress is derived from tracking data. |
| `Achievement` | `user`, `achievementId`, `unlockedAt` | Unique user/achievement pair. |
| `DailyChallenge` | `user`, `challengeId`, UTC `date`, `completedAt` | Unique user/date pair. |
| `Notification` | `user`, `category`, `sourceKey`, `title`, `message`, `readAt`, `dismissedAt` | Unique user/source key prevents duplicates; user/dismissal/creation-time index supports listing. |

## Relationships and lifecycle

- Rules, activities, sessions, goals, achievements, challenges, and notifications belong to a user.
- Sessions optionally reference a rule and also store a `ruleSnapshot` with the activity, target,
  limit, action, message, and rest duration in effect when the session began.
- Session states are `active`, `paused`, and `completed`. Paused intervals are recorded
  separately and excluded from `durationSeconds`.
- Goal `targetHistory` records when target changes take effect. Progress uses server-calculated
  analytics over UTC goal periods.
- Notification category is `achievements`, `challenges`, or `goals`. Dismissal and read state are
  represented by timestamps; dismissed items are omitted from the ordinary list.

## Migration/operations notes

Mongoose schema defaults do not rewrite existing documents automatically. Existing user records
without `role` or `tokenVersion` are handled as ordinary users/version 0 by the current
authentication serialization and verification logic; confirm indexes are built in the target
MongoDB deployment. Do not reset collections to test. No database migration command is currently
provided.
