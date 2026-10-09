import { useCallback, useEffect, useRef, useState } from 'react';
import ruleApi from '../services/ruleApi';
import sessionApi from '../services/sessionApi';
import { formatClock, getElapsedSeconds, getRemainingSeconds, getRestRemainingSeconds } from '../utils/timer';

const actionLabels = {
  blur: 'Blur reminder',
  warning: 'Warning',
  fullscreen_reminder: 'Fullscreen reminder',
  countdown: 'Countdown reminder',
  custom_message: 'Custom message',
  restriction: 'Restriction reminder',
};

function errorText(error, operation) {
  if (error.code === 'SESSION_ALREADY_ACTIVE') return 'An active session already exists. Reload the session status to reconnect.';
  if (error.code === 'INVALID_SESSION_STATE' || error.code === 'SESSION_STATE_CONFLICT') {
    return 'The session changed elsewhere. Reload its status and try again.';
  }
  if (error.code === 'REST_PERIOD_ACTIVE') return 'The configured rest period has not finished yet.';
  if (error.code === 'RULE_UNAVAILABLE') return 'That rule is no longer enabled. Choose an enabled rule.';
  if (error.code === 'TIME_LIMIT_NOT_REACHED') return 'The server has not yet recorded the configured time limit. Retry in a moment.';
  return `Could not ${operation}. Check your connection and retry.`;
}

function ActionButton({ children, onClick, disabled, tone = 'neutral' }) {
  const colors = tone === 'primary'
    ? 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'
    : tone === 'danger'
      ? 'border border-rose-800 text-rose-200 hover:border-rose-500'
      : 'border border-slate-700 text-slate-200 hover:border-cyan-400';
  return (
    <button
      className={`rounded-lg px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-400 disabled:cursor-not-allowed disabled:opacity-50 ${colors}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function RuleSummary({ rule }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <p className="font-medium text-white">{rule.target || rule.activity}</p>
      <p className="mt-1 text-sm text-slate-400">
        {rule.timeLimit} minute limit · {actionLabels[rule.action] || rule.action} · {rule.restDuration} minute rest
      </p>
      <p className="mt-2 break-words text-sm text-slate-300">{rule.message}</p>
    </div>
  );
}

function Intervention({ session, remainingRest, onResume, onEnd, pending, error }) {
  const rule = session.ruleSnapshot;
  const completed = remainingRest === 0;
  const action = actionLabels[rule?.action] || 'Screen-time reminder';

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/90 p-4 backdrop-blur-sm">
      <section
        aria-labelledby="timer-intervention-title"
        aria-modal="true"
        className="my-auto w-full max-w-lg rounded-2xl border border-cyan-800 bg-slate-900 p-6 shadow-2xl sm:p-8"
        role="dialog"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">{action}</p>
        <h2 className="mt-3 text-2xl font-semibold text-white" id="timer-intervention-title">
          {completed ? 'Rest period complete' : 'Your configured time limit has been reached'}
        </h2>
        <p className="mt-3 text-slate-300">{rule?.message || 'Your configured screen-time limit has been reached.'}</p>
        <p className="mt-5 text-sm text-slate-400">
          {rule?.activity}{rule?.target ? ` · ${rule.target}` : ''}
        </p>
        {!completed && (
          <>
            <p className="mt-6 font-mono text-4xl font-semibold tabular-nums text-cyan-200" aria-live="polite">
              {formatClock(remainingRest)}
            </p>
            <p className="mt-2 text-sm text-slate-400">Rest time remaining</p>
          </>
        )}
        {completed && (
          <p className="mt-4 text-sm text-emerald-200" role="status">Your rest countdown has finished. Resume when you’re ready.</p>
        )}
        {error && <p className="mt-4 text-sm text-rose-200" role="alert">{error}</p>}
        <p className="mt-5 rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-400">
          This in-app reminder pauses this RESTIFY session only. It cannot block access to apps or websites; platform enforcement is not connected.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <ActionButton disabled={pending} onClick={onEnd} tone="danger">
            End session
          </ActionButton>
          {completed && (
            <ActionButton disabled={pending} onClick={onResume} tone="primary">
              {pending ? 'Resuming...' : 'Resume session'}
            </ActionButton>
          )}
        </div>
      </section>
    </div>
  );
}

export default function SessionTimer() {
  const [rules, setRules] = useState([]);
  const [selectedRuleId, setSelectedRuleId] = useState('');
  const [rulesLoading, setRulesLoading] = useState(true);
  const [rulesError, setRulesError] = useState('');
  const [session, setSession] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const [operation, setOperation] = useState('');
  const [operationError, setOperationError] = useState('');
  const [clockNow, setClockNow] = useState(performance.now());
  const [wallNow, setWallNow] = useState(Date.now());
  const [synchronizedAt, setSynchronizedAt] = useState(null);
  const [interventionError, setInterventionError] = useState('');
  const thresholdAttempted = useRef(null);
  const busy = Boolean(operation);

  const acceptSession = useCallback((nextSession) => {
    setSession(nextSession);
    setSynchronizedAt(performance.now());
    setClockNow(performance.now());
    setWallNow(Date.now());
    setInterventionError('');
  }, []);

  const loadRules = useCallback(async () => {
    setRulesLoading(true);
    setRulesError('');
    try {
      const response = await ruleApi.list();
      const loadedRules = response.data.rules;
      setRules(loadedRules);
      setSelectedRuleId((current) => (
        loadedRules.some((rule) => rule.id === current && rule.enabled)
          ? current
          : loadedRules.find((rule) => rule.enabled)?.id || ''
      ));
    } catch {
      setRulesError('Could not load your rules. Timer controls require an enabled rule.');
    } finally {
      setRulesLoading(false);
    }
  }, []);

  const loadActiveSession = useCallback(async () => {
    setSessionLoading(true);
    setSessionError('');
    try {
      const response = await sessionApi.active();
      acceptSession(response.data.session);
      thresholdAttempted.current = null;
    } catch {
      setSessionError('Could not restore the current session. Retry before starting another timer.');
    } finally {
      setSessionLoading(false);
    }
  }, [acceptSession]);

  useEffect(() => {
    loadRules();
    loadActiveSession();
  }, [loadRules, loadActiveSession]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setClockNow(performance.now());
      setWallNow(Date.now());
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    function refreshWhenVisible() {
      if (document.visibilityState === 'visible' && session?.status === 'active') {
        loadActiveSession();
      }
    }
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => document.removeEventListener('visibilitychange', refreshWhenVisible);
  }, [loadActiveSession, session?.status]);

  const elapsedSeconds = getElapsedSeconds(session, synchronizedAt, clockNow);
  const remainingSeconds = getRemainingSeconds(session, synchronizedAt, clockNow);
  const ruleSnapshot = session?.ruleSnapshot;
  const hasRest = Boolean(session?.restStartedAt && session?.restEndsAt);
  const remainingRest = hasRest ? getRestRemainingSeconds(session.restEndsAt, wallNow) : 0;

  const runOperation = useCallback(async (name, request) => {
    setOperation(name);
    setOperationError('');
    try {
      const response = await request();
      acceptSession(response.data.session);
      return response.data.session;
    } catch (error) {
      setOperationError(errorText(error, name));
      if (error.code === 'REST_PERIOD_ACTIVE') {
        await loadActiveSession();
      }
      return null;
    } finally {
      setOperation('');
    }
  }, [acceptSession, loadActiveSession]);

  const triggerIntervention = useCallback(async () => {
    if (!session?.id || !ruleSnapshot || session.status !== 'active') return;
    if (thresholdAttempted.current === session.id) return;
    thresholdAttempted.current = session.id;

    setOperation('starting configured rest');
    setOperationError('');
    setInterventionError('');
    try {
      const currentRuleResponse = await ruleApi.get(session.ruleId);
      const currentRule = currentRuleResponse.data.rule;
      if (!currentRule.enabled) {
        setInterventionError('This rule has since been disabled; its time limit will not trigger an intervention.');
        return;
      }
      const response = await sessionApi.pause(session.id, { rest: true });
      acceptSession(response.data.session);
    } catch (error) {
      setInterventionError(error.code === 'RULE_NOT_FOUND'
        ? 'The associated rule is no longer available. The session remains active; end or pause it using the controls.'
        : errorText(error, 'start the configured rest period'));
    } finally {
      setOperation('');
    }
  }, [acceptSession, ruleSnapshot, session]);

  useEffect(() => {
    if (
      session?.status === 'active' &&
      ruleSnapshot &&
      remainingSeconds === 0
    ) {
      triggerIntervention();
    }
  }, [remainingSeconds, ruleSnapshot, session, triggerIntervention]);

  async function startSession() {
    if (!selectedRuleId) return;
    thresholdAttempted.current = null;
    await runOperation('start the timer', () => sessionApi.start(selectedRuleId));
  }

  async function pauseSession() {
    await runOperation('pause the session', () => sessionApi.pause(session.id));
  }

  async function resumeSession() {
    thresholdAttempted.current = null;
    await runOperation('resume the session', () => sessionApi.resume(session.id));
  }

  async function endSession() {
    const ended = await runOperation('end the session', () => sessionApi.end(session.id));
    if (ended?.status === 'completed') setSession(null);
  }

  function retryIntervention() {
    thresholdAttempted.current = null;
    setInterventionError('');
    triggerIntervention();
  }

  const enabledRules = rules.filter((rule) => rule.enabled);
  const sessionRule = ruleSnapshot || null;
  const progress = sessionRule
    ? Math.min(100, Math.round((elapsedSeconds / (sessionRule.timeLimit * 60)) * 100))
    : 0;
  const restComplete = hasRest && remainingRest === 0;

  return (
    <>
      <section
        id="timer"
        className="scroll-mt-24 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-black/10 sm:p-6"
        aria-labelledby="session-timer-title"
      >
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-400">Timed sessions</p>
          <h2 className="mt-2 text-xl font-semibold text-white" id="session-timer-title">Timer &amp; rest</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Track a session against one of your enabled rules. Timer time comes from the authenticated session service; the in-app intervention does not block other apps or websites.
          </p>
        </div>

        {sessionLoading ? (
          <p className="text-sm text-slate-400" role="status">Restoring session status...</p>
        ) : sessionError ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-900 bg-rose-950/30 px-4 py-3 text-sm text-rose-200" role="alert">
            <span>{sessionError}</span>
            <ActionButton onClick={loadActiveSession}>Retry</ActionButton>
          </div>
        ) : (
          <>
            {!session && (
              <div className="max-w-xl">
                {rulesLoading ? (
                  <p className="text-sm text-slate-400" role="status">Loading enabled rules...</p>
                ) : rulesError ? (
                  <div className="flex flex-wrap items-center gap-3 text-sm text-rose-200" role="alert">
                    <span>{rulesError}</span><ActionButton onClick={loadRules}>Retry</ActionButton>
                  </div>
                ) : enabledRules.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-700 bg-slate-950/50 p-4 text-sm text-slate-400">
                    No enabled rules are available. Enable or create a rule in the Rule Builder before starting a timed session.
                  </p>
                ) : (
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-56 flex-1">
                      <label className="text-sm font-medium text-slate-200" htmlFor="timer-rule">Rule for this session</label>
                      <select
                        className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
                        id="timer-rule"
                        value={selectedRuleId}
                        onChange={(event) => setSelectedRuleId(event.target.value)}
                      >
                        {enabledRules.map((rule) => (
                          <option key={rule.id} value={rule.id}>
                            {rule.target || rule.activity} · {rule.timeLimit} min
                          </option>
                        ))}
                      </select>
                    </div>
                    <ActionButton disabled={busy || !selectedRuleId} onClick={startSession} tone="primary">
                      {operation === 'start the timer' ? 'Starting...' : 'Start timer'}
                    </ActionButton>
                  </div>
                )}
              </div>
            )}

            {session && (
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,0.7fr)]">
                <div>
                  {sessionRule ? (
                    <RuleSummary rule={sessionRule} />
                  ) : (
                    <p className="rounded-xl border border-amber-900/70 bg-amber-950/30 p-4 text-sm text-amber-100">
                      This session was created without an associated rule. Timer controls are available, but no limit or intervention can be evaluated.
                    </p>
                  )}
                  <p className="mt-4 text-sm text-slate-400">
                    Session status: <span className="font-medium capitalize text-slate-200">{session.status}</span>
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 text-center">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {session.status === 'paused' && hasRest ? 'Rest remaining' : sessionRule ? 'Time remaining' : 'Elapsed time'}
                  </p>
                  <p className="mt-3 font-mono text-4xl font-semibold tabular-nums text-cyan-200" aria-live="off">
                    {session.status === 'paused' && hasRest
                      ? formatClock(remainingRest)
                      : sessionRule
                        ? formatClock(remainingSeconds)
                        : formatClock(elapsedSeconds)}
                  </p>
                  {sessionRule && (
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800" role="progressbar" aria-label="Rule time limit progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress}>
                      <div className="h-full rounded-full bg-cyan-400 transition-[width]" style={{ width: `${progress}%` }} />
                    </div>
                  )}
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    {session.status === 'active' ? (
                      <ActionButton disabled={busy} onClick={pauseSession}>
                        {operation === 'pause the session' ? 'Pausing...' : 'Pause'}
                      </ActionButton>
                    ) : (
                      <ActionButton disabled={busy || (hasRest && !restComplete)} onClick={resumeSession} tone="primary">
                        {operation === 'resume the session' ? 'Resuming...' : hasRest && !restComplete ? 'Resting...' : 'Resume'}
                      </ActionButton>
                    )}
                    <ActionButton disabled={busy} onClick={endSession} tone="danger">
                      {operation === 'end the session' ? 'Ending...' : 'End session'}
                    </ActionButton>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {operationError && <p className="mt-4 text-sm text-rose-200" role="alert">{operationError}</p>}
        {interventionError && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-900 bg-rose-950/30 px-4 py-3 text-sm text-rose-200" role="alert">
            <span>{interventionError}</span>
            {session?.status === 'active' && remainingSeconds === 0 && (
              <ActionButton disabled={busy} onClick={retryIntervention}>Retry intervention</ActionButton>
            )}
          </div>
        )}
      </section>

      {session && hasRest && (
        <Intervention
          session={session}
          remainingRest={remainingRest}
          onResume={resumeSession}
          onEnd={endSession}
          pending={busy}
          error={operationError}
        />
      )}
    </>
  );
}
