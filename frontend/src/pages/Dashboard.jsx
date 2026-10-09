import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import RuleBuilder from '../components/RuleBuilder';
import SessionTimer from '../components/SessionTimer';
import achievementApi from '../services/achievementApi';
import analyticsApi from '../services/analyticsApi';
import challengeApi from '../services/challengeApi';
import goalApi from '../services/goalApi';
import streakApi from '../services/streakApi';
import NotificationCenter from '../components/NotificationCenter';
import { usePreferences } from '../context/PreferencesContext';

const resources = {
  today: async () => (await analyticsApi.today()).data.analytics,
  weekly: async () => (await analyticsApi.weekly()).data.analytics,
  monthly: async () => (await analyticsApi.monthly()).data.analytics,
  ranking: async () => (await analyticsApi.ranking()).data.ranking.ranking,
  heatmap: async () => (await analyticsApi.heatmap()).data.heatmap,
  goals: async () => (await goalApi.list()).data.goals,
  streak: async () => (await streakApi.get()).data.streak,
  achievements: async () => (await achievementApi.list()).data.achievements,
  challenge: async () => (await challengeApi.today()).data.challenge,
};

function useDashboardResource(name) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await resources[name]());
    } catch {
      setData(null);
      setError('This section could not be loaded. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [name]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload, setData };
}

function formatDuration(seconds = 0) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0 min';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  return `${minutes} min`;
}

function formatShortDate(value) {
  if (!value) return '';
  return new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function Section({ id, title, description, resource, children, className = '' }) {
  return (
    <section
      id={id}
      className={`scroll-mt-24 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-black/10 sm:p-6 ${className}`}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
        </div>
        {resource?.error && (
          <button
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-cyan-200 hover:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            onClick={resource.reload}
            type="button"
          >
            Retry
          </button>
        )}
      </div>
      {resource?.loading ? (
        <div className="animate-pulse space-y-3" role="status" aria-label={`Loading ${title}`}>
          <div className="h-5 w-1/3 rounded bg-slate-800" />
          <div className="h-24 rounded-xl bg-slate-800/80" />
          <span className="sr-only">Loading {title}...</span>
        </div>
      ) : resource?.error ? (
        <p className="rounded-lg border border-rose-900/80 bg-rose-950/30 px-4 py-3 text-sm text-rose-200" role="alert">
          {resource.error}
        </p>
      ) : (
        children
      )}
    </section>
  );
}

function MetricCard({ label, value, detail, accent = 'cyan' }) {
  const colors = {
    cyan: 'text-cyan-200 bg-cyan-400/10',
    violet: 'text-violet-200 bg-violet-400/10',
    emerald: 'text-emerald-200 bg-emerald-400/10',
    amber: 'text-amber-200 bg-amber-400/10',
  };
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
      <p className="text-sm font-medium text-slate-400">{label}</p>
      <p className={`mt-3 inline-flex rounded-lg px-3 py-1.5 text-2xl font-semibold ${colors[accent]}`}>
        {value}
      </p>
      <p className="mt-3 text-sm text-slate-500">{detail}</p>
    </article>
  );
}

function DayBars({ days = [], compact = false }) {
  const maximum = Math.max(0, ...days.map((day) => day.totalDurationSeconds || 0));
  return (
    <div className={`flex min-h-44 items-end gap-2 overflow-x-auto pb-1 ${compact ? 'min-w-[620px]' : ''}`}>
      {days.map((day) => {
        const height = maximum ? Math.max(5, (day.totalDurationSeconds / maximum) * 100) : 0;
        const date = formatShortDate(day.date);
        return (
          <div className="group flex min-w-8 flex-1 flex-col items-center gap-2" key={day.date}>
            <span className="text-[10px] text-slate-500 opacity-0 transition group-hover:opacity-100">
              {day.totalDurationSeconds ? formatDuration(day.totalDurationSeconds) : 'No data'}
            </span>
            <div className="flex h-28 w-full items-end rounded-t-md bg-slate-950/70">
              <div
                className={`w-full rounded-t-md ${day.totalDurationSeconds ? 'bg-cyan-400' : 'bg-slate-800'}`}
                style={{ height: `${height}%` }}
                role="img"
                aria-label={`${date}: ${formatDuration(day.totalDurationSeconds)}`}
              />
            </div>
            <span className="text-center text-[10px] text-slate-500">{date}</span>
          </div>
        );
      })}
      {!days.length && <p className="text-sm text-slate-400">No daily data is available yet.</p>}
    </div>
  );
}

function Heatmap({ cells = [] }) {
  const maximum = Math.max(0, ...cells.map((cell) => cell.durationSeconds || 0));
  if (!cells.length) return <EmptyMessage text="No screen-time history is available yet." />;
  return (
    <div>
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-10" role="list" aria-label="Daily screen-time heatmap">
        {cells.map((cell) => {
          const ratio = maximum ? cell.durationSeconds / maximum : 0;
          const shade =
            ratio === 0
              ? 'bg-slate-800'
              : ratio < 0.25
                ? 'bg-cyan-950'
                : ratio < 0.5
                  ? 'bg-cyan-800'
                  : ratio < 0.75
                    ? 'bg-cyan-600'
                    : 'bg-cyan-400';
          return (
            <div
              className={`aspect-square rounded-md ${shade}`}
              key={cell.date}
              role="listitem"
              title={`${formatShortDate(cell.date)}: ${formatDuration(cell.durationSeconds)}`}
              aria-label={`${formatShortDate(cell.date)}: ${formatDuration(cell.durationSeconds)}`}
            />
          );
        })}
      </div>
      <div className="mt-4 flex items-center justify-end gap-2 text-xs text-slate-500" aria-label="Heatmap intensity: lower to higher">
        <span>Less</span>
        <i className="h-3 w-3 rounded-sm bg-slate-800" />
        <i className="h-3 w-3 rounded-sm bg-cyan-950" />
        <i className="h-3 w-3 rounded-sm bg-cyan-800" />
        <i className="h-3 w-3 rounded-sm bg-cyan-600" />
        <i className="h-3 w-3 rounded-sm bg-cyan-400" />
        <span>More</span>
      </div>
    </div>
  );
}

function EmptyMessage({ text, linkTo, linkText }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 px-4 py-6 text-center">
      <p className="text-sm text-slate-400">{text}</p>
      {linkTo && (
        <Link className="mt-3 inline-block text-sm font-medium text-cyan-300 hover:text-cyan-200" to={linkTo}>
          {linkText}
        </Link>
      )}
    </div>
  );
}

function PreferencesPanel() {
  const { preferences, saving, error, updatePreferences } = usePreferences();
  const categories = [
    ['achievements', 'Achievement unlocks'],
    ['challenges', 'Daily challenge completions'],
    ['goals', 'Goal updates'],
  ];

  async function save(patch) {
    try {
      await updatePreferences(patch);
    } catch {
      return;
    }
  }

  return (
    <Section id="settings" title="Personalization" description="Choose how RESTIFY looks and which in-app updates you receive.">
      <div className="grid gap-6 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-200">Appearance</span>
          <select
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            disabled={saving}
            onChange={(event) => save({ theme: event.target.value })}
            value={preferences.theme}
          >
            <option value="system">Use device setting</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
          <span className="mt-2 block text-xs text-slate-500">Applies across RESTIFY and is saved to your account.</span>
        </label>
        <fieldset className="space-y-3">
          <legend className="mb-2 text-sm font-medium text-slate-200">In-app notifications</legend>
          {categories.map(([key, label]) => (
            <label className="flex items-center gap-3 text-sm text-slate-300" key={key}>
              <input
                checked={preferences.notifications[key]}
                className="h-4 w-4 accent-cyan-400"
                disabled={saving}
                onChange={(event) => save({ notifications: { [key]: event.target.checked } })}
                type="checkbox"
              />
              {label}
            </label>
          ))}
        </fieldset>
      </div>
      {saving && <p className="mt-4 text-xs text-slate-400" role="status">Saving preferences…</p>}
      {error && <p className="mt-4 text-sm text-rose-200" role="alert">{error}</p>}
    </Section>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const today = useDashboardResource('today');
  const weekly = useDashboardResource('weekly');
  const monthly = useDashboardResource('monthly');
  const ranking = useDashboardResource('ranking');
  const heatmap = useDashboardResource('heatmap');
  const goals = useDashboardResource('goals');
  const streak = useDashboardResource('streak');
  const achievements = useDashboardResource('achievements');
  const challenge = useDashboardResource('challenge');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [challengeAction, setChallengeAction] = useState({ loading: false, error: '' });

  async function handleLogout() {
    let notice;
    try {
      await logout();
    } catch {
      notice = 'Your local session was cleared, but the sign-out request could not be confirmed.';
    } finally {
      navigate('/login', { replace: true, state: notice ? { notice } : undefined });
    }
  }

  async function handleChallengeCompletion() {
    setChallengeAction({ loading: true, error: '' });
    try {
      const response = await challengeApi.completeToday();
      challenge.setData(response.data.challenge);
      setChallengeAction({ loading: false, error: '' });
    } catch (error) {
      const message =
        error.code === 'CHALLENGE_NOT_MET'
          ? 'Track and stop an activity today before completing this challenge.'
          : 'Could not verify the challenge right now. Please retry.';
      setChallengeAction({ loading: false, error: message });
    }
  }

  const navItems = [
    ['Overview', '#overview'],
    ["Today's time", '#today'],
    ['Timer', '#timer'],
    ['Analytics', '#weekly'],
    ['Goals', '#goals'],
    ['Rules', '#rules'],
    ['Streaks', '#streaks'],
    ['Achievements', '#achievements'],
    ['Challenge', '#challenge'],
    ['Settings', '#settings'],
  ];

  const todaySeconds = today.data?.totalDurationSeconds;
  const weeklySeconds = weekly.data?.totalDurationSeconds;
  const monthlySeconds = monthly.data?.totalDurationSeconds;
  const unlockedCount = achievements.data?.filter((item) => item.unlocked).length;
  const trackedToday = Boolean(today.data?.activities?.length);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/dashboard" className="shrink-0 text-sm font-bold tracking-[0.24em] text-cyan-300">
            RESTIFY
          </Link>
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Dashboard navigation">
            {navItems.map(([label, href]) => (
              <a
                className="rounded-lg px-3 py-2 text-sm text-slate-400 transition hover:bg-slate-900 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                href={href}
                key={href}
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden max-w-36 truncate text-sm text-slate-400 sm:block">{user?.name}</span>
            {user?.role === 'admin' && (
              <Link className="rounded-lg border border-violet-700 px-3 py-2 text-sm text-violet-200 hover:border-violet-400" to="/admin">
                Admin
              </Link>
            )}
            <Link className="rounded-lg bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300" to="/focus">
              Focus mode
            </Link>
            <NotificationCenter />
            <button
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-rose-400 hover:text-rose-200 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              onClick={handleLogout}
              type="button"
            >
              Sign out
            </button>
            <button
              aria-expanded={mobileNavOpen}
              aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-400 lg:hidden"
              onClick={() => setMobileNavOpen((open) => !open)}
              type="button"
            >
              {mobileNavOpen ? 'Close' : 'Menu'}
            </button>
          </div>
        </div>
        {mobileNavOpen && (
          <nav className="grid grid-cols-2 gap-1 border-t border-slate-800 px-4 py-3 sm:px-6 lg:hidden" aria-label="Mobile dashboard navigation">
            {navItems.map(([label, href]) => (
              <a
                className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                href={href}
                key={href}
                onClick={() => setMobileNavOpen(false)}
              >
                {label}
              </a>
            ))}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <section id="overview" className="mb-8 scroll-mt-24">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-400">Your wellbeing overview</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                A clearer view of your screen time.
              </h1>
              <p className="mt-2 text-slate-400">Welcome back, {user?.name || 'there'}. Your progress is based on recorded activity.</p>
            </div>
            <a href="#today" className="rounded-lg bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-200">
              View today
            </a>
          </div>
        </section>

        <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Screen-time summary">
          <MetricCard
            label="Today"
            value={today.loading ? 'Loading' : today.error ? 'Unavailable' : trackedToday ? formatDuration(todaySeconds) : 'No data'}
            detail={today.loading ? 'Loading today’s analytics' : today.error ? 'Today’s analytics unavailable' : trackedToday ? 'Recorded screen time' : 'No activity recorded today'}
          />
          <MetricCard
            label="This week"
            value={weekly.loading ? 'Loading' : weekly.error ? 'Unavailable' : weekly.data?.activities?.length ? formatDuration(weeklySeconds) : 'No data'}
            detail={weekly.loading ? 'Loading weekly analytics' : weekly.error ? 'Weekly analytics unavailable' : 'Current UTC week'}
            accent="violet"
          />
          <MetricCard
            label="This month"
            value={monthly.loading ? 'Loading' : monthly.error ? 'Unavailable' : monthly.data?.activities?.length ? formatDuration(monthlySeconds) : 'No data'}
            detail={monthly.loading ? 'Loading monthly analytics' : monthly.error ? 'Monthly analytics unavailable' : 'Current UTC month'}
            accent="emerald"
          />
          <MetricCard
            label="Achievements"
            value={achievements.loading ? 'Loading' : achievements.error ? 'Unavailable' : unlockedCount ?? 0}
            detail={achievements.loading ? 'Loading achievements' : achievements.error ? 'Achievement data unavailable' : 'Unlocked achievements'}
            accent="amber"
          />
        </section>

        <div className="mb-5">
          <SessionTimer />
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          <Section id="today" title="Today's screen time" description="Recorded usage and activity breakdown." resource={today} className="xl:col-span-2">
            {today.data?.activities?.length ? (
              <>
                <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                  <p className="text-3xl font-semibold text-cyan-200">{formatDuration(today.data.totalDurationSeconds)}</p>
                  <p className="text-sm text-slate-400">UTC day · {today.data.period?.start ? formatShortDate(today.data.period.start) : 'Today'}</p>
                </div>
                <div className="space-y-3">
                  {today.data.activities.map((item) => {
                    const width = today.data.totalDurationSeconds
                      ? Math.min(100, (item.durationSeconds / today.data.totalDurationSeconds) * 100)
                      : 0;
                    return (
                      <div key={`${item.activity}-${item.target || ''}`}>
                        <div className="mb-1 flex justify-between gap-3 text-sm">
                          <span className="truncate text-slate-200">{item.activity}{item.target ? ` · ${item.target}` : ''}</span>
                          <span className="shrink-0 text-slate-400">{formatDuration(item.durationSeconds)}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-800" aria-label={`${item.activity} duration`}>
                          <div className="h-full rounded-full bg-cyan-400" style={{ width: `${width}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <EmptyMessage text="No screen-time activity has been recorded for today." />
            )}
          </Section>

          <Section id="streaks" title="Goal streak" description="Consecutive completed days, calculated from tracked history." resource={streak}>
            {streak.data ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-950/70 p-4">
                  <p className="text-sm text-slate-400">Current</p>
                  <p className="mt-2 text-3xl font-semibold text-cyan-200">{streak.data.currentStreak} <span className="text-sm font-normal text-slate-400">days</span></p>
                </div>
                <div className="rounded-xl bg-slate-950/70 p-4">
                  <p className="text-sm text-slate-400">Longest</p>
                  <p className="mt-2 text-3xl font-semibold text-white">{streak.data.longestStreak} <span className="text-sm font-normal text-slate-400">days</span></p>
                </div>
                <p className="col-span-2 text-xs text-slate-500">Last qualifying day: {streak.data.lastCompletionDate ? formatShortDate(streak.data.lastCompletionDate) : 'None yet'} · UTC</p>
              </div>
            ) : (
              <EmptyMessage text="No qualifying daily goal history yet." />
            )}
          </Section>

          <Section id="weekly" title="Weekly screen time" description="Daily totals for the current week." resource={weekly} className="overflow-hidden xl:col-span-2">
            {weekly.data ? (
              <>
                <p className="mb-5 text-2xl font-semibold text-white">{weekly.data.activities?.length ? formatDuration(weekly.data.totalDurationSeconds) : 'No recorded time'}</p>
                <div className="-mx-1 overflow-x-auto px-1"><DayBars days={weekly.data.days || []} /></div>
              </>
            ) : <EmptyMessage text="No weekly analytics are available." />}
          </Section>

          <Section id="goals" title="Your goals" description="Progress and remaining time from actual analytics." resource={goals}>
            {goals.data?.length ? (
              <div className="space-y-4">
                {goals.data.map((goal) => {
                  const progress = goal.progress;
                  const usedPercent = Math.min(100, progress?.percentUsed || 0);
                  return (
                    <article className="rounded-xl bg-slate-950/70 p-4" key={goal.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-medium capitalize text-white">{goal.period} limit</h3>
                          <p className="mt-1 text-sm text-slate-400">{formatDuration(goal.targetMinutes * 60)} target</p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-xs ${progress?.isComplete ? 'bg-cyan-400/10 text-cyan-200' : goal.isActive ? 'bg-emerald-400/10 text-emerald-200' : 'bg-slate-800 text-slate-400'}`}>
                          {progress?.isComplete ? 'Period complete' : goal.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={usedPercent} aria-label={`${goal.period} goal usage`}>
                        <div className="h-full rounded-full bg-violet-400" style={{ width: `${usedPercent}%` }} />
                      </div>
                      <p className="mt-2 text-xs text-slate-400">
                        {progress?.hasTrackedData
                          ? `${formatDuration(progress.totalDurationSeconds)} used · ${formatDuration(progress.remainingSeconds)} remaining`
                          : 'No recorded activity for this goal period yet.'}
                      </p>
                      {progress?.isComplete && <p className="mt-2 text-sm text-emerald-300">Goal period complete.</p>}
                    </article>
                  );
                })}
              </div>
            ) : <EmptyMessage text="You have not created a screen-time goal yet." />}
          </Section>

          <Section id="monthly" title="Monthly screen time" description="Daily recorded totals for the current UTC month." resource={monthly} className="overflow-hidden xl:col-span-2">
            {monthly.data ? (
              <>
                <p className="mb-5 text-2xl font-semibold text-white">{monthly.data.activities?.length ? formatDuration(monthly.data.totalDurationSeconds) : 'No recorded time'}</p>
                <div className="-mx-1 overflow-x-auto px-1"><DayBars days={monthly.data.days || []} compact /></div>
              </>
            ) : <EmptyMessage text="No monthly analytics are available." />}
          </Section>

          <Section id="ranking" title="Activity ranking" description="Ranked by recorded duration in the current month." resource={ranking}>
            {ranking.data?.length ? (
              <ol className="space-y-3">
                {ranking.data.map((item) => (
                  <li className="flex items-center gap-3 rounded-xl bg-slate-950/70 p-3" key={`${item.activity}-${item.target || ''}`}>
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-cyan-400/10 text-sm font-semibold text-cyan-200">{item.rank}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{item.activity}{item.target ? ` · ${item.target}` : ''}</span>
                    <span className="shrink-0 text-sm text-slate-400">{formatDuration(item.durationSeconds)}</span>
                  </li>
                ))}
              </ol>
            ) : <EmptyMessage text="No ranked activities have been recorded this month." />}
          </Section>

          <Section id="heatmap" title="Screen-time heatmap" description="Daily recorded activity over the latest 30 UTC days." resource={heatmap} className="xl:col-span-3">
            {heatmap.data?.cells ? <Heatmap cells={heatmap.data.cells} /> : <EmptyMessage text="No heatmap history is available." />}
          </Section>

          <Section id="achievements" title="Achievements" description="Unlock status returned by RESTIFY." resource={achievements} className="xl:col-span-2">
            {achievements.data?.length ? (
              <ul className="grid gap-3 sm:grid-cols-2">
                {achievements.data.map((item) => (
                  <li className={`rounded-xl border p-4 ${item.unlocked ? 'border-amber-700/50 bg-amber-400/5' : 'border-slate-800 bg-slate-950/50'}`} key={item.id}>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium text-white">{item.name}</h3>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] ${item.unlocked ? 'bg-amber-400/10 text-amber-200' : 'bg-slate-800 text-slate-400'}`}>
                        {item.unlocked ? 'Unlocked' : 'Locked'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">{item.description}</p>
                    {item.unlocked && item.unlockedAt && <p className="mt-3 text-xs text-amber-200/80">Unlocked {new Date(item.unlockedAt).toLocaleDateString()}</p>}
                  </li>
                ))}
              </ul>
            ) : <EmptyMessage text="No achievement definitions are available." />}
          </Section>

          <Section id="challenge" title="Daily challenge" description="Completion is verified by the backend against your activity records." resource={challenge}>
            {challenge.data ? (
              <div className="rounded-xl bg-slate-950/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-white">{challenge.data.name}</h3>
                    <p className="mt-2 text-sm text-slate-400">{challenge.data.description}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs ${challenge.data.completed ? 'bg-emerald-400/10 text-emerald-200' : 'bg-slate-800 text-slate-300'}`}>
                    {challenge.data.completed ? 'Completed' : 'In progress'}
                  </span>
                </div>
                <p className="mt-3 text-xs text-slate-500">{formatShortDate(challenge.data.date)} · UTC</p>
                {challengeAction.error && <p className="mt-3 text-sm text-rose-200" role="alert">{challengeAction.error}</p>}
                {!challenge.data.completed && (
                  <button
                    className="mt-4 rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-cyan-200"
                    disabled={challengeAction.loading}
                    onClick={handleChallengeCompletion}
                    type="button"
                  >
                    {challengeAction.loading ? 'Verifying...' : 'Verify completion'}
                  </button>
                )}
              </div>
            ) : <EmptyMessage text="There is no daily challenge available." />}
          </Section>
        </div>

        <div className="mt-5">
          <RuleBuilder />
        </div>

        <div className="mt-5">
          <PreferencesPanel />
        </div>

        <footer className="mt-8 flex flex-wrap justify-between gap-3 border-t border-slate-800 pt-5 text-sm text-slate-500">
          <span>RESTIFY · Use Technology. Take Control. Rest Better.</span>
          <span>{user?.email}</span>
        </footer>
      </main>
    </div>
  );
}
