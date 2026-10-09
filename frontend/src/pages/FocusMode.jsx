import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ruleApi from '../services/ruleApi';
import sessionApi from '../services/sessionApi';
import {
  formatClock,
  getElapsedSeconds,
  getRemainingSeconds,
  getRestRemainingSeconds,
} from '../utils/timer';

function errorMessage(error, action) {
  if (error.code === 'SESSION_ALREADY_ACTIVE') return 'A session is already active. Reload to reconnect to it.';
  if (error.code === 'INVALID_SESSION_STATE' || error.code === 'SESSION_STATE_CONFLICT') {
    return 'This session changed in another RESTIFY view. Its current state has been reloaded.';
  }
  if (error.code === 'REST_PERIOD_ACTIVE') return 'The configured rest period is still in progress.';
  if (error.code === 'TIME_LIMIT_NOT_REACHED') return 'RESTIFY has not yet recorded the configured time limit. Retry shortly.';
  if (error.code === 'RULE_UNAVAILABLE') return 'This rule is no longer enabled. The session remains available to pause or end.';
  return `Could not ${action}. Check your connection and try again.`;
}

function ControlButton({ children, onClick, disabled, primary = false, danger = false }) {
  const tone = primary
    ? 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'
    : danger
      ? 'border border-rose-800 text-rose-200 hover:border-rose-500'
      : 'border border-slate-700 text-slate-200 hover:border-cyan-400';
  return (
    <button
      className={`rounded-xl px-5 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-400 disabled:cursor-not-allowed disabled:opacity-50 ${tone}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function Completion({ session, onRestart }) {
  const duration = Math.max(0, session?.durationSeconds || 0);
  const activity = session?.ruleSnapshot?.target || session?.ruleSnapshot?.activity;
  return (
    <section className="w-full max-w-2xl rounded-3xl border border-emerald-800/70 bg-slate-900/80 p-7 text-center shadow-2xl sm:p-12">
      <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-300">Focus complete</p>
      <h1 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">Well done. You showed up.</h1>
      <p className="mx-auto mt-4 max-w-lg text-slate-300">
        {activity ? `Your ${activity} session` : 'Your focus session'} has been saved. Consider a short screen-free break before your next task.
      </p>
      <div className="mx-auto mt-8 max-w-xs rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
        <p className="text-sm text-slate-400">Recorded focus time</p>
        <p className="mt-2 font-mono text-4xl font-semibold tabular-nums text-cyan-200">{formatClock(duration)}</p>
      </div>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ControlButton onClick={onRestart} primary>Start another focus session</ControlButton>
        <Link className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 hover:border-cyan-400" to="/dashboard">
          Back to dashboard
        </Link>
      </div>
    </section>
  );
}

export default function FocusMode() {
  const [rules, setRules] = useState([]);
  const [selectedRuleId, setSelectedRuleId] = useState('');
  const [rulesLoading, setRulesLoading] = useState(true);
  const [rulesError, setRulesError] = useState('');
  const [session, setSession] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const [operation, setOperation] = useState('');
  const [error, setError] = useState('');
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [clockNow, setClockNow] = useState(performance.now());
  const [wallNow, setWallNow] = useState(Date.now());
  const synchronizedAt = useRef(null);
  const inFlight = useRef(false);

  const acceptSession = useCallback((next) => {
    setSession(next);
    synchronizedAt.current = performance.now();
    setClockNow(performance.now());
    setWallNow(Date.now());
    setSessionError('');
    setError('');
  }, []);

  const loadRules = useCallback(async () => {
    setRulesLoading(true);
    setRulesError('');
    try {
      const response = await ruleApi.list();
      const enabled = response.data.rules.filter((rule) => rule.enabled);
      setRules(enabled);
      setSelectedRuleId((current) => (
        enabled.some((rule) => rule.id === current) ? current : enabled[0]?.id || ''
      ));
    } catch {
      setRulesError('Could not load enabled rules. Retry before starting a focus session.');
    } finally {
      setRulesLoading(false);
    }
  }, []);

  const loadActiveSession = useCallback(async () => {
    setSessionError('');
    try {
      const response = await sessionApi.active();
      acceptSession(response.data.session);
    } catch {
      setSessionError('Could not restore your current session. Retry before starting another.');
    } finally {
      setSessionLoading(false);
    }
  }, [acceptSession]);

  useEffect(() => {
    loadRules();
    loadActiveSession();
  }, [loadRules, loadActiveSession]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setClockNow(performance.now());
      setWallNow(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (session?.status !== 'active') return undefined;
    const interval = window.setInterval(() => {
      if (!inFlight.current && document.visibilityState === 'visible') loadActiveSession();
    }, 30000);
    return () => window.clearInterval(interval);
  }, [session?.status, loadActiveSession]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !inFlight.current) loadActiveSession();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [loadActiveSession]);

  const elapsedSeconds = getElapsedSeconds(session, synchronizedAt.current, clockNow);
  const remainingSeconds = getRemainingSeconds(session, synchronizedAt.current, clockNow);
  const hasRule = Boolean(session?.ruleSnapshot);
  const hasActiveRest = session?.status === 'paused' && Boolean(session?.restStartedAt && session?.restEndsAt);
  const restRemaining = hasActiveRest ? getRestRemainingSeconds(session.restEndsAt, wallNow) : 0;
  const limitReached = hasRule && session?.status === 'active' && remainingSeconds === 0;
  const progress = hasRule
    ? Math.min(100, Math.round((elapsedSeconds / (session.ruleSnapshot.timeLimit * 60)) * 100))
    : 0;

  const run = useCallback(async (name, request) => {
    if (inFlight.current) return null;
    inFlight.current = true;
    setOperation(name);
    setError('');
    try {
      const response = await request();
      acceptSession(response.data.session);
      return response.data.session;
    } catch (requestError) {
      setError(errorMessage(requestError, name));
      if (['INVALID_SESSION_STATE', 'SESSION_STATE_CONFLICT', 'REST_PERIOD_ACTIVE', 'SESSION_ALREADY_ACTIVE'].includes(requestError.code)) {
        try {
          const current = await sessionApi.active();
          acceptSession(current.data.session);
        } catch {
          setSessionError('The session changed elsewhere, but its latest status could not be loaded. Retry.');
        }
      }
      return null;
    } finally {
      inFlight.current = false;
      setOperation('');
    }
  }, [acceptSession]);

  async function start() {
    if (!selectedRuleId) return;
    await run('start your focus session', () => sessionApi.start(selectedRuleId));
  }

  async function pause() {
    await run('pause your focus session', () => sessionApi.pause(session.id));
  }

  async function startRest() {
    await run('start your configured rest', () => sessionApi.pause(session.id, { rest: true }));
  }

  async function resume() {
    await run('resume your focus session', () => sessionApi.resume(session.id));
  }

  async function end() {
    const completed = await run('save your completed session', () => sessionApi.end(session.id));
    if (completed?.status === 'completed') {
      setConfirmEnd(false);
      setSession(completed);
    }
  }

  function startAnother() {
    setSession(null);
    synchronizedAt.current = null;
    setError('');
    setSessionError('');
    setConfirmEnd(false);
  }

  const isBusy = Boolean(operation);
  const completedSession = session?.status === 'completed' ? session : null;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-5 text-slate-100 sm:px-8 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-5xl flex-col">
        <header className="flex items-center justify-between gap-4">
          <Link className="text-sm font-bold tracking-[0.24em] text-cyan-300" to="/dashboard">RESTIFY</Link>
          <Link className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-cyan-400" to="/dashboard">
            Exit focus mode
          </Link>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center py-10">
          {sessionLoading ? (
            <p className="text-sm text-slate-400" role="status">Restoring your session…</p>
          ) : sessionError && !session ? (
            <section className="w-full max-w-xl rounded-2xl border border-rose-900 bg-slate-900 p-6" role="alert">
              <h1 className="text-xl font-semibold text-white">Session status unavailable</h1>
              <p className="mt-2 text-sm text-rose-200">{sessionError}</p>
              <ControlButton onClick={loadActiveSession}>Retry</ControlButton>
            </section>
          ) : completedSession ? (
            <Completion session={completedSession} onRestart={startAnother} />
          ) : !session ? (
            <section className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-900/80 p-7 shadow-2xl sm:p-12">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">Focus mode</p>
              <h1 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">Make space for one thing.</h1>
              <p className="mt-4 max-w-xl text-slate-400">Choose an enabled rule, then begin a focused session. RESTIFY saves session time through your account and can restore it if you return later.</p>
              {rulesLoading ? (
                <p className="mt-8 text-sm text-slate-400" role="status">Loading enabled rules…</p>
              ) : rulesError ? (
                <div className="mt-8" role="alert">
                  <p className="mb-3 text-sm text-rose-200">{rulesError}</p>
                  <ControlButton onClick={loadRules}>Retry rules</ControlButton>
                </div>
              ) : rules.length === 0 ? (
                <div className="mt-8 rounded-xl border border-dashed border-slate-700 bg-slate-950/50 p-5">
                  <p className="text-sm text-slate-300">Enable a rule in your dashboard before starting focus mode.</p>
                  <Link className="mt-3 inline-block text-sm font-semibold text-cyan-300 hover:text-cyan-200" to="/dashboard#rules">Open Rule Builder →</Link>
                </div>
              ) : (
                <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end">
                  <label className="flex-1 text-sm font-medium text-slate-200" htmlFor="focus-rule">
                    Focus rule
                    <select
                      className="mt-2 block w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                      id="focus-rule"
                      onChange={(event) => setSelectedRuleId(event.target.value)}
                      value={selectedRuleId}
                    >
                      {rules.map((rule) => (
                        <option key={rule.id} value={rule.id}>
                          {rule.target || rule.activity} · {rule.timeLimit} min
                        </option>
                      ))}
                    </select>
                  </label>
                  <ControlButton disabled={isBusy || !selectedRuleId} onClick={start} primary>
                    {operation ? 'Starting…' : 'Begin focus'}
                  </ControlButton>
                </div>
              )}
              {error && <p className="mt-4 text-sm text-rose-200" role="alert">{error}</p>}
            </section>
          ) : (
            <section className="w-full max-w-3xl rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl sm:p-10">
              {sessionError && (
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-900 bg-rose-950/30 p-4 text-sm text-rose-200" role="alert">
                  <span>{sessionError}</span>
                  <ControlButton onClick={loadActiveSession}>Reload session</ControlButton>
                </div>
              )}
              <div className="text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">
                  {session.status === 'paused' ? hasActiveRest && restRemaining > 0 ? 'Rest break' : 'Paused' : 'Focus in progress'}
                </p>
                <h1 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
                  {session.ruleSnapshot?.target || session.ruleSnapshot?.activity || 'Your focus session'}
                </h1>
                {session.ruleSnapshot?.message && <p className="mt-2 text-sm text-slate-400">{session.ruleSnapshot.message}</p>}
                <p className="mt-8 font-mono text-6xl font-semibold tabular-nums tracking-tight text-cyan-200 sm:text-8xl" aria-live="off">
                  {session.status === 'paused' && hasActiveRest
                    ? formatClock(restRemaining)
                    : hasRule
                      ? formatClock(remainingSeconds)
                      : formatClock(elapsedSeconds)}
                </p>
                <p className="mt-3 text-sm text-slate-400">
                  {session.status === 'paused' && hasActiveRest
                    ? 'Configured rest remaining'
                    : hasRule
                      ? `${formatClock(elapsedSeconds)} focused · ${session.ruleSnapshot.timeLimit} minute target`
                      : `${formatClock(elapsedSeconds)} focused`}
                </p>
                {hasRule && (
                  <div className="mx-auto mt-6 h-2 max-w-xl overflow-hidden rounded-full bg-slate-800" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress} aria-label="Focus time progress">
                    <div className={`h-full rounded-full transition-[width] ${limitReached ? 'bg-amber-400' : 'bg-cyan-400'}`} style={{ width: `${progress}%` }} />
                  </div>
                )}
                {limitReached && (
                  <div className="mx-auto mt-6 max-w-xl rounded-xl border border-amber-800 bg-amber-950/30 p-4 text-left">
                    <p className="font-medium text-amber-100">Your focus target is complete.</p>
                    <p className="mt-1 text-sm text-amber-200/80">
                      Consider taking the configured {session.ruleSnapshot.restDuration}-minute rest before continuing.
                    </p>
                  </div>
                )}
                {session.status === 'paused' && hasActiveRest && restRemaining === 0 && (
                  <p className="mx-auto mt-6 max-w-xl rounded-xl border border-emerald-800 bg-emerald-950/30 p-4 text-sm text-emerald-200" role="status">
                    Your rest period is complete. Resume when you’re ready.
                  </p>
                )}
              </div>

              <div className="mt-8 flex flex-wrap justify-center gap-3">
                {session.status === 'active' ? (
                  <>
                    <ControlButton disabled={isBusy} onClick={pause}>{operation ? 'Pausing…' : 'Pause'}</ControlButton>
                    {limitReached && <ControlButton disabled={isBusy} onClick={startRest} primary>{operation ? 'Starting rest…' : `Take ${session.ruleSnapshot.restDuration}-minute rest`}</ControlButton>}
                  </>
                ) : (
                  <ControlButton disabled={isBusy || (hasActiveRest && restRemaining > 0)} onClick={resume} primary>
                    {isBusy ? 'Resuming…' : hasActiveRest && restRemaining > 0 ? 'Resting…' : 'Resume focus'}
                  </ControlButton>
                )}
                <ControlButton disabled={isBusy} onClick={() => setConfirmEnd(true)} danger>End session</ControlButton>
              </div>

              {error && <p className="mt-5 text-center text-sm text-rose-200" role="alert">{error}</p>}
            </section>
          )}
        </div>

        <footer className="flex flex-col justify-between gap-2 border-t border-slate-800 pt-4 text-xs text-slate-500 sm:flex-row">
          <span>RESTIFY Focus Mode · Your time is measured by the session service.</span>
          <span>Take a mindful break when you need one.</span>
        </footer>
      </div>

      {confirmEnd && session?.status !== 'completed' && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4" role="presentation">
          <section aria-labelledby="focus-end-title" aria-modal="true" className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl" role="dialog">
            <h2 className="text-xl font-semibold text-white" id="focus-end-title">End this focus session?</h2>
            <p className="mt-2 text-sm text-slate-300">RESTIFY will save the time recorded so far. You can start another session whenever you’re ready.</p>
            {error && <p className="mt-3 text-sm text-rose-200" role="alert">{error}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <ControlButton disabled={isBusy} onClick={() => setConfirmEnd(false)}>Keep focusing</ControlButton>
              <ControlButton disabled={isBusy} onClick={end} danger>{isBusy ? 'Saving…' : 'End and save'}</ControlButton>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
