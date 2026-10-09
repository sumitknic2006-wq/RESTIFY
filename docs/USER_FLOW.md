# User flows

The flows below describe supported application behavior. API route details are in
[API documentation](API_DOCUMENTATION.md).

## Register, sign in, and sign out

1. A visitor opens the web app and can register or sign in.
2. Registration validates name, email, and password; the server stores a bcrypt password hash
   and returns a signed bearer token plus safe user profile.
3. The web app stores the token under `restify.auth.token` in localStorage and restores the current
   profile through `GET /api/auth/me`.
4. Protected routes wait for session restoration. Invalid/expired/revoked tokens require sign-in.
5. Sign-out calls the authenticated logout endpoint, invalidating account tokens server-side,
   then clears the local token and user state.

## Configure a rule and track a session

1. From the dashboard, create a rule with an activity/site, time limit, intervention action,
   message, and rest duration. A custom website rule also needs a domain.
2. Start a session from the web focus page or an eligible extension tab. A session may reference
   an enabled owned rule; the API snapshots its settings at session start.
3. Pause/resume/end the session. Active duration is maintained by server timestamps; paused
   intervals do not count. A user may have one open session at a time.
4. Revisit the focus page to recover the user's active or paused session from the API.

## Review progress and preferences

1. The dashboard loads analytics, goals, streaks, achievements, daily challenge, notifications,
   and enabled rules for the signed-in account.
2. Daily/weekly goal progress and analytics derive from persisted tracking records; client-supplied
   durations are not accepted as the source of truth.
3. A qualifying daily challenge can be completed only after the backend finds an eligible
   tracking entry. Notification records are deduplicated by user/source.
4. Theme (`system`, `light`, `dark`) and notification category preferences persist on the profile.
   Notification items can be marked read or dismissed.

## Administrator overview

1. An operator creates the intended account normally and promotes it only through the trusted
   `backend/scripts/promote-admin.js` command described in [setup](SETUP.md).
2. An authenticated admin opens `/admin`; ordinary users are blocked in the UI and rejected by
   the protected `/api/admin/*` routes.
3. The admin can see aggregate registered-user/completed-session metrics and a limited,
   paginated/searchable account directory. This area is read-only.

## Browser extension

1. The user loads the unpacked extension in a compatible Chrome browser and signs in in its popup.
2. The service worker checks the focused active HTTP(S) tab, browser idle state, and enabled user
   rules, then starts/stops sessions through the API.
3. At a configured limit, a rule-linked session may enter rest and the content script displays
   an overlay. After rest ends, the user resumes tracking.

The extension is optional and limited to supported browser contexts. See the
[extension guide](../browser-extension/README.md) for permission and enforcement boundaries.
