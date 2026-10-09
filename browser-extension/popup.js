const byId = (id) => document.getElementById(id);

function showNotice(text, isError = false) {
  const notice = byId('notice');
  notice.textContent = text;
  notice.className = `notice${isError ? ' error' : ''}`;
  notice.hidden = !text;
}

function send(command, data = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: 'RESTIFY_POPUP', command, ...data }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error('RESTIFY extension service is unavailable. Reload the extension and retry.'));
      } else if (!response?.ok) {
        reject(new Error(response?.error || 'RESTIFY request failed.'));
      } else {
        resolve(response.result);
      }
    });
  });
}

function statusPresentation(monitor) {
  const map = {
    tracking: ['Tracking', `${monitor.activity || 'Website'} · ${monitor.host || ''} · ${Math.floor(monitor.elapsedSeconds / 60)} min used`],
    rest: ['Rest in progress', `${monitor.activity || 'Rule'} · rest countdown running in this browser`],
    'rest-complete': ['Rest period complete', 'Resume tracking when you are ready.'],
    waiting: ['Ready', 'Open a supported website in the active tab to begin.'],
    unmatched: ['Not tracking this website', `${monitor.host || 'Website'} does not match an enabled rule.`],
    'signed-out': ['Disconnected', 'Sign in to sync your RESTIFY rules.'],
    error: ['Connection issue', monitor.error || 'Could not sync with RESTIFY.'],
  };
  return map[monitor.mode] || ['Checking status', 'Refreshing rules and active tab status.'];
}

async function refresh() {
  try {
    let result = await send('status');
    if (result.authenticated) {
      await send('refresh');
      result = await send('status');
    }
    byId('signed-out').hidden = result.authenticated;
    byId('signed-in').hidden = !result.authenticated;
    byId('api-base').value = result.apiBase;
    byId('dashboard-url').value = result.dashboardUrl;
    byId('login-api-base').value = result.apiBase;
    byId('login-dashboard-url').value = result.dashboardUrl;
    byId('api-base').readOnly = result.authenticated;
    byId('save-api').disabled = result.authenticated;
    byId('resume-session').hidden = result.monitor.mode !== 'rest-complete';
    if (result.user) {
      byId('user-name').textContent = result.user.name;
      byId('user-email').textContent = result.user.email || '';
    }
    const [title, detail] = statusPresentation(result.monitor);
    byId('status-title').textContent = title;
    byId('status-detail').textContent = detail;
    byId('status-dot').className = `dot${result.monitor.mode === 'tracking' || result.monitor.mode === 'rest' ? ' ok' : result.monitor.mode === 'error' ? ' error' : ''}`;
  } catch (error) {
    showNotice(error.message, true);
  }
}

byId('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = byId('login-button');
  button.disabled = true;
  showNotice('');
  try {
    await send('set-api', { apiBase: byId('login-api-base').value.trim() });
    await send('set-dashboard', { dashboardUrl: byId('login-dashboard-url').value.trim() });
    await send('login', {
      credentials: {
        email: byId('email').value.trim(),
        password: byId('password').value,
      },
    });
    byId('password').value = '';
    showNotice('Connected to RESTIFY.');
    await refresh();
  } catch (error) {
    showNotice(error.message, true);
  } finally {
    button.disabled = false;
  }
});

byId('sign-out').addEventListener('click', async () => {
  try {
    await send('logout');
    showNotice('Signed out.');
    await refresh();
  } catch (error) {
    showNotice(error.message, true);
  }
});

byId('resume-session').addEventListener('click', async () => {
  const button = byId('resume-session');
  button.disabled = true;
  showNotice('');
  try {
    await send('resume');
    await refresh();
  } catch (error) {
    showNotice(error.message, true);
  } finally {
    button.disabled = false;
  }
});

byId('save-api').addEventListener('click', async () => {
  try {
    const apiBase = await send('set-api', { apiBase: byId('api-base').value.trim() });
    byId('api-base').value = apiBase;
    showNotice('RESTIFY API address saved.');
    await refresh();
  } catch (error) {
    showNotice(error.message, true);
  }
});

byId('save-dashboard').addEventListener('click', async () => {
  try {
    const dashboardUrl = await send('set-dashboard', {
      dashboardUrl: byId('dashboard-url').value.trim(),
    });
    byId('dashboard-url').value = dashboardUrl;
    showNotice('Dashboard address saved.');
  } catch (error) {
    showNotice(error.message, true);
  }
});

byId('dashboard').addEventListener('click', async () => {
  try {
    await send('open-dashboard');
  } catch (error) {
    showNotice(error.message, true);
  }
});

refresh();
