(() => {
  let hostElement;
  let countdownInterval;

  function formatClock(seconds) {
    const value = Math.max(0, Math.ceil(seconds));
    const minutes = Math.floor(value / 60);
    const remainder = value % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
  }

  function clearIntervention() {
    if (countdownInterval) {
      window.clearInterval(countdownInterval);
      countdownInterval = null;
    }
    hostElement?.remove();
    hostElement = null;
  }

  function showIntervention(intervention) {
    clearIntervention();
    if (!intervention || !Number.isFinite(intervention.restEndsAt)) return;

    hostElement = document.createElement('div');
    hostElement.setAttribute('aria-live', 'polite');
    const shadow = hostElement.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = `
      :host { all: initial; }
      .scrim { position: fixed; inset: 0; z-index: 2147483647; display: grid; place-items: center; padding: 20px; background: rgba(2, 6, 23, .94); color: #e2e8f0; font: 16px/1.5 system-ui, sans-serif; }
      .card { box-sizing: border-box; width: min(100%, 440px); padding: 28px; border: 1px solid #155e75; border-radius: 20px; background: #0f172a; box-shadow: 0 25px 80px rgba(0, 0, 0, .55); text-align: center; }
      .brand { color: #67e8f9; font-size: 12px; font-weight: 700; letter-spacing: .22em; text-transform: uppercase; }
      h1 { margin: 12px 0; color: white; font-size: 24px; }
      p { margin: 10px 0; color: #cbd5e1; }
      .clock { margin-top: 22px; color: #a5f3fc; font: 600 44px/1.2 ui-monospace, monospace; }
      .note { margin-top: 20px; color: #94a3b8; font-size: 12px; }
    `;
    const card = document.createElement('main');
    card.className = 'scrim';
    const content = document.createElement('section');
    content.className = 'card';
    const brand = document.createElement('div');
    brand.className = 'brand';
    brand.textContent = 'RESTIFY';
    const heading = document.createElement('h1');
    heading.textContent = 'Your rest period is in progress';
    const target = document.createElement('p');
    target.textContent = [intervention.activity, intervention.target].filter(Boolean).join(' · ');
    const message = document.createElement('p');
    message.textContent = intervention.message || 'Pause and take a mindful break.';
    const clock = document.createElement('div');
    clock.className = 'clock';
    const note = document.createElement('p');
    note.className = 'note';
    note.textContent = 'This reminder applies in this browser page only; it cannot block other apps or browsers.';
    content.append(brand, heading, target, message, clock, note);
    card.append(content);
    shadow.append(style, card);
    (document.documentElement || document.body).append(hostElement);

    const update = () => {
      const remaining = Math.max(0, Math.ceil((intervention.restEndsAt - Date.now()) / 1000));
      clock.textContent = formatClock(remaining);
      if (remaining === 0) {
        heading.textContent = 'Rest period complete';
        note.textContent = 'Return to RESTIFY to resume your session when you are ready.';
        window.clearInterval(countdownInterval);
        countdownInterval = null;
      }
    };
    update();
    countdownInterval = window.setInterval(update, 1000);
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'RESTIFY_SHOW_REST') showIntervention(message);
    if (message?.type === 'RESTIFY_CLEAR') clearIntervention();
  });

  chrome.runtime.sendMessage({ type: 'RESTIFY_GET_INTERVENTION' }, (response) => {
    if (!chrome.runtime.lastError && response?.intervention) showIntervention(response.intervention);
  });
})();
