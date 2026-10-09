importScripts('rules.js');

const DEFAULT_API_BASE = 'http://localhost:5000/api';
const DEFAULT_DASHBOARD_URL = 'http://localhost:5173/dashboard';
const API_BASE_KEY = 'apiBase';
const DASHBOARD_URL_KEY = 'dashboardUrl';
const TOKEN_KEY = 'token';
const USER_KEY = 'user';
const STATE_KEY = 'monitorState';
const MONITOR_ALARM = 'restify-monitor';
const REST_ALARM = 'restify-rest';

let refreshQueue = Promise.resolve();
const trustedStorageReady = chrome.storage.local.setAccessLevel({
  accessLevel: 'TRUSTED_CONTEXTS',
});

function normalizeApiBase(value) {
  const url = new URL(value || DEFAULT_API_BASE);
  const localHost = ['localhost', '127.0.0.1'].includes(url.hostname);
  if (
    (url.protocol !== 'https:' && !(localHost && url.protocol === 'http:')) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error('Use HTTPS for remote RESTIFY servers. HTTP is allowed only for localhost.');
  }
  const path = url.pathname.replace(/\/+$/, '');
  if (path && path !== '/api') throw new Error('RESTIFY API address must end at /api.');
  return `${url.origin}/api`;
}

async function readSettings() {
  await trustedStorageReady;
  const values = await chrome.storage.local.get([
    API_BASE_KEY,
    DASHBOARD_URL_KEY,
    TOKEN_KEY,
    USER_KEY,
    STATE_KEY,
  ]);
  return {
    apiBase: normalizeApiBase(values[API_BASE_KEY] || DEFAULT_API_BASE),
    dashboardUrl: normalizeDashboardUrl(values[DASHBOARD_URL_KEY] || DEFAULT_DASHBOARD_URL),
    token: values[TOKEN_KEY] || '',
    user: values[USER_KEY] || null,
    state: values[STATE_KEY] || {},
  };
}

function normalizeDashboardUrl(value) {
  const url = new URL(value || DEFAULT_DASHBOARD_URL);
  const localHost = ['localhost', '127.0.0.1'].includes(url.hostname);
  if (
    (url.protocol !== 'https:' && !(localHost && url.protocol === 'http:')) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error('Use HTTPS for a remote dashboard. HTTP is allowed only for localhost.');
  }
  return url.href.replace(/\/+$/, '');
}

async function writeState(state) {
  await chrome.storage.local.set({ [STATE_KEY]: state });
}

async function clearAuthentication() {
  const { state } = await readSettings();
  if (state.sessionId) {
    try {
      await apiRequest(`/sessions/${encodeURIComponent(state.sessionId)}/end`, { method: 'PATCH' });
    } catch (error) {
      if (error.code !== 'INVALID_SESSION_STATE' && error.code !== 'SESSION_NOT_FOUND' && error.status !== 401) {
        throw new Error('Could not end the extension session. Check the RESTIFY connection and retry sign-out.');
      }
    }
  }
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } catch (error) {
    if (error.status !== 401) {
      throw new Error('Could not securely sign out of RESTIFY. Check the connection and retry.');
    }
  }
  await chrome.storage.local.remove([TOKEN_KEY, USER_KEY, STATE_KEY]);
  await chrome.alarms.clear(MONITOR_ALARM);
  await chrome.alarms.clear(REST_ALARM);
  await clearRestOverlays();
}

async function apiRequest(path, options = {}) {
  const settings = await readSettings();
  if (!settings.token && !options.allowUnauthenticated) {
    throw new Error('Sign in to RESTIFY to connect the extension.');
  }
  const headers = { 'Content-Type': 'application/json' };
  if (settings.token) headers.Authorization = `Bearer ${settings.token}`;
  const response = await fetch(`${settings.apiBase}${path}`, {
    method: options.method || 'GET',
    headers,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (response.status === 401) {
    await chrome.storage.local.remove([TOKEN_KEY, USER_KEY]);
    throw new Error('Your RESTIFY session expired. Sign in again.');
  }
  if (!response.ok) {
    const error = new Error(payload?.message || 'RESTIFY request failed.');
    error.code = payload?.code;
    error.status = response.status;
    throw error;
  }
  return payload;
}

function safeApiError(error) {
  return error instanceof Error ? error.message : 'RESTIFY is unavailable. Check the connection and try again.';
}

async function sendTabMessage(tabId, message) {
  if (!Number.isInteger(tabId)) return;
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch {
    // Restricted pages, closed tabs, and not-yet-loaded content scripts are not injectable.
  }
}

async function clearRestOverlays() {
  const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
  await Promise.all(tabs.map((tab) => sendTabMessage(tab.id, { type: 'RESTIFY_CLEAR' })));
}

function parseSupportedUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return { host: url.hostname.toLowerCase(), url: url.href };
  } catch {
    return null;
  }
}

async function getFocusedActiveTab() {
  const windows = await chrome.windows.getLastFocused();
  if (!windows || windows.id === chrome.windows.WINDOW_ID_NONE || !windows.focused) return null;
  const tabs = await chrome.tabs.query({ active: true, windowId: windows.id });
  return tabs[0] || null;
}

async function endOwnedSession(state) {
  if (!state.sessionId) return;
  try {
    await apiRequest(`/sessions/${encodeURIComponent(state.sessionId)}/end`, { method: 'PATCH' });
  } catch (error) {
    if (error.code !== 'INVALID_SESSION_STATE' && error.code !== 'SESSION_NOT_FOUND') throw error;
  }
  await writeState({});
}

async function resumeOwnedSession(state) {
  if (!state.sessionId) throw new Error('No RESTIFY browser session is ready to resume.');
  await apiRequest(`/sessions/${encodeURIComponent(state.sessionId)}/resume`, { method: 'PATCH' });
  const session = await getCurrentSession(state.sessionId);
  if (session?.status !== 'active') throw new Error('RESTIFY could not resume the browser session.');
  await writeState({ ...state, mode: 'active' });
  await clearRestOverlays();
  await chrome.alarms.clear(REST_ALARM);
  return scheduleMonitor();
}

async function startOwnedSession(rule, tab, host) {
  const response = await apiRequest('/sessions/start', {
    method: 'POST',
    body: { ruleId: rule.id },
  });
  const session = response?.data?.session;
  if (!session?.id || session.ruleSnapshot?.timeLimit !== rule.timeLimit) {
    throw new Error('RESTIFY returned an invalid session response.');
  }
  const state = {
    sessionId: session.id,
    ruleId: rule.id,
    tabId: tab.id,
    host,
    mode: 'active',
  };
  await writeState(state);
  return session;
}

async function getCurrentSession(sessionId) {
  const response = await apiRequest('/sessions/active');
  const session = response?.data?.session;
  return session?.id === sessionId ? session : null;
}

async function showRestOnTab(tabId, session) {
  const endAt = session.restEndsAt ? new Date(session.restEndsAt).getTime() : 0;
  if (!endAt) return;
  await sendTabMessage(tabId, {
    type: 'RESTIFY_SHOW_REST',
    activity: session.ruleSnapshot?.activity || 'Screen-time rule',
    target: session.ruleSnapshot?.target || null,
    message: session.ruleSnapshot?.message || '',
    restEndsAt: endAt,
  });
}

async function reconcileRest(session, activeTab) {
  const restEndsAt = new Date(session.restEndsAt || 0).getTime();
  if (!Number.isFinite(restEndsAt) || restEndsAt <= 0) {
    await writeState({});
    await chrome.alarms.clear(REST_ALARM);
    return { mode: 'error', error: 'RESTIFY returned invalid rest timing data.' };
  }
  const { state } = await readSettings();
  await writeState({ ...state, mode: 'rest' });
  if (activeTab) await showRestOnTab(activeTab.id, session);
  if (restEndsAt <= Date.now()) {
    await chrome.alarms.clear(REST_ALARM);
    return {
      mode: 'rest-complete',
      activity: session.ruleSnapshot?.activity || 'Screen-time rule',
      restEndsAt,
      sessionId: session.id,
    };
  }
  chrome.alarms.create(REST_ALARM, { when: Math.min(restEndsAt, Date.now() + 30000) });
  return {
    mode: 'rest',
    activity: session.ruleSnapshot?.activity || 'Screen-time rule',
    restEndsAt,
    sessionId: session.id,
  };
}

async function monitorOnce() {
  const settings = await readSettings();
  if (!settings.token) {
    await writeState({});
    return { mode: 'signed-out' };
  }

  const { state } = settings;
  const activeTab = await getFocusedActiveTab();
  const idleState = await chrome.idle.queryState(60);
  const page = activeTab ? parseSupportedUrl(activeTab.url || '') : null;

  if (state.sessionId) {
    const session = await getCurrentSession(state.sessionId);
    if (!session) {
      await writeState({});
      await clearRestOverlays();
    } else if (session.status === 'paused' && session.restEndsAt) {
      return reconcileRest(session, activeTab);
    } else if (
      session.status === 'active' &&
      session.ruleSnapshot?.timeLimit &&
      session.durationSeconds >= session.ruleSnapshot.timeLimit * 60
    ) {
      try {
        await apiRequest(`/sessions/${encodeURIComponent(session.id)}/pause`, {
          method: 'PATCH',
          body: { rest: true },
        });
        const updated = await getCurrentSession(session.id);
        if (updated?.status === 'paused' && updated.restEndsAt) return reconcileRest(updated, activeTab);
      } catch (error) {
        return { mode: 'error', error: safeApiError(error), host: page?.host || state.host };
      }
    } else if (
      session.status !== 'active' ||
      idleState !== 'active' ||
      !page ||
      state.tabId !== activeTab.id ||
      state.host !== page.host
    ) {
      await endOwnedSession(state);
      await clearRestOverlays();
    } else {
      if (state.mode === 'rest') {
        await clearRestOverlays();
        await writeState({ ...state, mode: 'active' });
      }
      const elapsed = Math.max(0, Number(session.durationSeconds) || 0);
      const limitSeconds = (session.ruleSnapshot?.timeLimit || 0) * 60;
      return {
        mode: 'tracking',
        host: page.host,
        activity: session.ruleSnapshot?.activity || 'Screen-time session',
        elapsedSeconds: elapsed,
        limitSeconds,
      };
    }
  }

  await clearRestOverlays();
  if (!activeTab || idleState !== 'active' || !page) return { mode: 'waiting' };

  let rules;
  try {
    const response = await apiRequest('/rules');
    rules = response?.data?.rules;
    if (!Array.isArray(rules)) throw new Error('RESTIFY returned invalid rules data.');
  } catch (error) {
    return { mode: 'error', error: safeApiError(error), host: page.host };
  }
  const rule = self.RestifyRules.selectRuleForHost(rules, page.host);
  if (!rule) return { mode: 'unmatched', host: page.host };
  try {
    const session = await startOwnedSession(rule, activeTab, page.host);
    const limitSeconds = (session.ruleSnapshot.timeLimit || 0) * 60;
    return {
      mode: 'tracking',
      host: page.host,
      activity: session.ruleSnapshot.activity,
      elapsedSeconds: session.durationSeconds || 0,
      limitSeconds,
    };
  } catch (error) {
    return { mode: 'error', error: safeApiError(error), host: page.host };
  }
}

function scheduleMonitor() {
  refreshQueue = refreshQueue
    .then(monitorOnce)
    .then(async (status) => {
      await chrome.storage.local.set({ status });
      return status;
    })
    .catch(async (error) => {
      const status = { mode: 'error', error: safeApiError(error) };
      await chrome.storage.local.set({ status });
      return status;
    });
  return refreshQueue;
}

async function login(credentials) {
  const settings = await readSettings();
  if (settings.token) {
    throw new Error('Sign out of the connected account before signing in with another account.');
  }
  const response = await fetch(`${settings.apiBase}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || 'Could not sign in to RESTIFY.');
  const token = payload?.data?.token;
  const user = payload?.data?.user;
  if (typeof token !== 'string' || !user?.id || typeof user.name !== 'string') {
    throw new Error('RESTIFY returned invalid sign-in data.');
  }
  await chrome.storage.local.set({ [TOKEN_KEY]: token, [USER_KEY]: user, [STATE_KEY]: {} });
  chrome.alarms.create(MONITOR_ALARM, { periodInMinutes: 0.5 });
  return { name: user.name, email: user.email };
}

async function status() {
  const settings = await readSettings();
  const values = await chrome.storage.local.get(['status']);
  return {
    authenticated: Boolean(settings.token),
    user: settings.user,
    apiBase: settings.apiBase,
    dashboardUrl: settings.dashboardUrl,
    monitor: values.status || { mode: settings.token ? 'waiting' : 'signed-out' },
  };
}

async function updateApiBase(apiBase) {
  const { token } = await readSettings();
  if (token) throw new Error('Sign out before changing the RESTIFY API address.');
  const normalized = normalizeApiBase(apiBase);
  await chrome.storage.local.set({ [API_BASE_KEY]: normalized });
  return normalized;
}

async function updateDashboardUrl(dashboardUrl) {
  const normalized = normalizeDashboardUrl(dashboardUrl);
  await chrome.storage.local.set({ [DASHBOARD_URL_KEY]: normalized });
  return normalized;
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(MONITOR_ALARM, { periodInMinutes: 0.5 });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(MONITOR_ALARM, { periodInMinutes: 0.5 });
  scheduleMonitor();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === MONITOR_ALARM || alarm.name === REST_ALARM) scheduleMonitor();
});

chrome.tabs.onActivated.addListener(scheduleMonitor);
chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (changeInfo.status === 'complete' || changeInfo.url) scheduleMonitor();
});
chrome.windows.onFocusChanged.addListener(scheduleMonitor);
chrome.idle.onStateChanged.addListener(scheduleMonitor);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'RESTIFY_GET_INTERVENTION') {
    if (sender.id !== chrome.runtime.id || !Number.isInteger(sender.tab?.id) || !parseSupportedUrl(sender.url)) {
      return false;
    }
    readSettings()
      .then(({ state }) => {
        if (!state.sessionId) {
          sendResponse({ intervention: null });
          return;
        }
        return getCurrentSession(state.sessionId).then((session) => {
          if (session?.status === 'paused' && session.restEndsAt) {
            return {
              intervention: {
                activity: session.ruleSnapshot?.activity || 'Screen-time rule',
                target: session.ruleSnapshot?.target || null,
                message: session.ruleSnapshot?.message || '',
                restEndsAt: new Date(session.restEndsAt).getTime(),
              },
            };
          }
          return { intervention: null };
        });
      })
      .then((result) => sendResponse(result || { intervention: null }))
      .catch(() => sendResponse({ intervention: null }));
    return true;
  }

  if (
    message?.type !== 'RESTIFY_POPUP' ||
    sender.id !== chrome.runtime.id ||
    sender.tab ||
    sender.url !== chrome.runtime.getURL('popup.html')
  ) return false;
  let task;
  if (message.command === 'status') task = status();
  else if (message.command === 'login') task = login(message.credentials || {});
  else if (message.command === 'logout') task = clearAuthentication().then(() => ({ signedOut: true }));
  else if (message.command === 'resume') task = readSettings().then(({ state }) => resumeOwnedSession(state));
  else if (message.command === 'set-api') task = updateApiBase(message.apiBase);
  else if (message.command === 'set-dashboard') task = updateDashboardUrl(message.dashboardUrl);
  else if (message.command === 'refresh') task = scheduleMonitor();
  else if (message.command === 'open-dashboard') {
    task = readSettings().then(({ dashboardUrl }) => chrome.tabs.create({ url: dashboardUrl }));
  } else return false;

  Promise.resolve(task)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: safeApiError(error) }));
  return true;
});
