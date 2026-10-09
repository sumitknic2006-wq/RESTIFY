# RESTIFY browser extension

RESTIFY uses a Manifest V3 browser extension with a service worker, a popup, and a content script. The service worker stores the RESTIFY token in extension-local storage and is the only extension component that sends authenticated API requests. Web pages receive only a rest-intervention message; the token is never provided to a content script.

## Install for local development

1. Start the RESTIFY backend and frontend using their existing development commands.
2. Use Chrome 102 or newer. From `chrome://extensions`, enable **Developer mode** and choose **Load unpacked**.
3. Select this `browser-extension/` directory.
4. Open RESTIFY from the extension toolbar, set the API address (default: `http://localhost:5000/api`) and dashboard address (default: `http://localhost:5173/dashboard`) in the sign-in form, then sign in with a RESTIFY account.
5. Create or enable a rule in RESTIFY's Rule Builder. Open a supported website in the active browser tab. The popup reports whether the extension is tracking, resting, waiting, or unable to connect.

Use HTTPS for remote RESTIFY servers. Plain HTTP is accepted only for localhost addresses. The extension needs its declared host access to detect supported sites and make authenticated API requests. Review browser permission prompts before enabling it.

## Behavior and limitations

- Supported browser targets are Instagram, YouTube, Facebook, X/Twitter, Netflix, a custom website domain (including its subdomains), and Any Website.
- The extension tracks the focused, active HTTP(S) tab while the browser reports recent user activity. It starts and ends sessions through the existing authenticated `/api/sessions` endpoints, with the enabled rule ID. RESTIFY persists the rule snapshot and authoritative duration; no client-supplied elapsed value is sent.
- At the rule limit, the extension asks the existing session endpoint to start the configured rest period. The content script displays the saved message and a rest countdown in the current browser page. When the rest period completes, use **Resume tracking** in the popup or resume from RESTIFY.
- Existing active sessions started elsewhere are not adopted or modified by the extension. The backend's one-open-session-per-user guard may reject extension tracking while another RESTIFY session is active.
- A browser content overlay is an in-browser reminder, not tamper-proof blocking. This extension cannot monitor native desktop/mobile applications, other browsers, or restricted browser pages. It does not implement notifications or personalization.
- Backend availability and valid authentication are required. Expired authentication is cleared and requires signing in again. A network interruption can delay stopping or reconciling a session; the popup reports API errors rather than claiming that synchronization succeeded.

## Validate

Run `npm run check` from this directory to validate JavaScript syntax, parse the manifest, and run the rule-matching/contract tests. Loading the unpacked extension in Chrome or another compatible MV3 browser is still required to verify browser permission prompts, tab events, content script injection, and real backend integration.
