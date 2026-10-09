import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import adminApi from '../services/adminApi';

function formatDuration(seconds = 0) {
  if (!Number.isFinite(seconds) || seconds < 0) return 'Unavailable';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes} min`;
}

function Stat({ label, value, detail }) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{detail}</p>
    </article>
  );
}

function dayLabel(value) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export default function AdminDashboard() {
  const [days, setDays] = useState(30);
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState('');
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, pages: 0 });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState('');

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewError('');
    try {
      const response = await adminApi.overview(days);
      setOverview(response.data.overview);
    } catch {
      setOverviewError('Admin statistics are unavailable. Check the connection and retry.');
    } finally {
      setOverviewLoading(false);
    }
  }, [days]);

  const loadUsers = useCallback(async (page = 1) => {
    setUsersLoading(true);
    setUsersError('');
    try {
      const response = await adminApi.users({ page, limit: 25, search, role });
      setUsers(response.data.users);
      setPagination(response.data.pagination);
    } catch {
      setUsersError('User records could not be loaded. Check the connection and retry.');
    } finally {
      setUsersLoading(false);
    }
  }, [search, role]);

  useEffect(() => { loadOverview(); }, [loadOverview]);
  useEffect(() => { loadUsers(1); }, [loadUsers]);

  function submitSearch(event) {
    event.preventDefault();
    setSearch(searchInput.trim());
  }

  const stats = overview?.sessions;
  const maxSessions = Math.max(1, ...(stats?.daily || []).map((day) => day.completedCount));

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-400">RESTIFY administration</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Platform overview</h1>
            <p className="mt-2 text-sm text-slate-400">Aggregated platform metrics and limited account metadata.</p>
          </div>
          <Link className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-cyan-400" to="/dashboard">
            Return to RESTIFY
          </Link>
        </header>

        <section aria-label="Platform statistics">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-white">Platform statistics</h2>
              <p className="mt-1 text-xs text-slate-500">Session activity is based on completed sessions ended during the selected UTC period.</p>
            </div>
            <label className="text-sm text-slate-300">
              Range
              <select
                className="ml-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                onChange={(event) => setDays(Number(event.target.value))}
                value={days}
              >
                <option value="7">7 days</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
              </select>
            </label>
          </div>
          {overviewLoading ? (
            <p className="rounded-xl bg-slate-900 p-5 text-sm text-slate-400" role="status">Loading platform statistics…</p>
          ) : overviewError ? (
            <div className="rounded-xl border border-rose-900 bg-rose-950/30 p-4 text-sm text-rose-200" role="alert">
              {overviewError} <button className="ml-2 underline" onClick={loadOverview} type="button">Retry</button>
            </div>
          ) : overview ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Stat label="Registered users" value={overview.registeredUsers} detail="All accounts · aggregate count" />
                <Stat label="Completed sessions" value={stats.completedCount} detail={`${days}-day UTC period`} />
                <Stat label="Completed session time" value={formatDuration(stats.recordedDurationSeconds)} detail="Completed sessions only" />
                <Stat label="Rule-linked sessions" value={stats.focusCount} detail="Completed sessions with a saved rule" />
              </div>
              <section className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                <h3 className="font-semibold text-white">Completed sessions per day</h3>
                {stats.daily.every((day) => day.completedCount === 0) ? (
                  <p className="mt-4 rounded-xl border border-dashed border-slate-700 p-5 text-sm text-slate-400">No completed sessions in this period.</p>
                ) : (
                  <div className="mt-5 flex h-44 items-end gap-1 overflow-x-auto" role="img" aria-label={`Completed sessions per day over ${days} days`}>
                    {stats.daily.map((day) => (
                      <div className="group flex h-full min-w-3 flex-1 flex-col items-center justify-end" key={day.date} title={`${dayLabel(day.date)}: ${day.completedCount} sessions`}>
                        <span className="mb-1 text-[10px] text-slate-400 opacity-0 group-hover:opacity-100">{day.completedCount}</span>
                        <div className={`w-full rounded-t-sm ${day.completedCount ? 'bg-cyan-400' : 'bg-slate-800'}`} style={{ height: `${day.completedCount ? Math.max(5, (day.completedCount / maxSessions) * 100) : 3}%` }} />
                        {(days <= 7 || day.date.endsWith('-01') || day.date.endsWith('-15')) && <span className="mt-2 whitespace-nowrap text-[10px] text-slate-500">{dayLabel(day.date)}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </section>
              <p className="mt-3 text-xs text-slate-500">Database status: {overview.services.database || 'Unavailable'} · does not include connection credentials.</p>
            </>
          ) : null}
        </section>

        <section className="mt-10" aria-labelledby="admin-users-title">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-white" id="admin-users-title">User management</h2>
            <p className="mt-1 text-sm text-slate-400">Read-only account directory. Passwords, preferences, activity details, and tokens are not exposed.</p>
          </div>
          <form className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:flex-row" onSubmit={submitSearch}>
            <label className="flex-1 text-sm text-slate-300">
              Search by name or email
              <input
                autoComplete="off"
                className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                maxLength={100}
                onChange={(event) => setSearchInput(event.target.value)}
                value={searchInput}
              />
            </label>
            <label className="text-sm text-slate-300">
              Role
              <select className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100" onChange={(event) => setRole(event.target.value)} value={role}>
                <option value="all">All roles</option>
                <option value="user">Users</option>
                <option value="admin">Admins</option>
              </select>
            </label>
            <button className="self-end rounded-lg bg-cyan-400 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-300" type="submit">Search</button>
          </form>
          {usersLoading ? (
            <p className="rounded-xl bg-slate-900 p-5 text-sm text-slate-400" role="status">Loading user records…</p>
          ) : usersError ? (
            <div className="rounded-xl border border-rose-900 bg-rose-950/30 p-4 text-sm text-rose-200" role="alert">
              {usersError} <button className="ml-2 underline" onClick={() => loadUsers(pagination.page)} type="button">Retry</button>
            </div>
          ) : users.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">No user accounts match this search.</p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-2xl border border-slate-800">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead className="bg-slate-900 text-xs uppercase tracking-wide text-slate-400">
                    <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Registered</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-slate-900/60">
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td className="px-4 py-3 font-medium text-slate-100">{user.name}</td>
                        <td className="px-4 py-3 text-slate-300">{user.email}</td>
                        <td className="px-4 py-3 capitalize text-slate-300">{user.role}</td>
                        <td className="px-4 py-3 text-slate-400">{new Date(user.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
                <span>{pagination.total} accounts · page {pagination.page} of {Math.max(1, pagination.pages)}</span>
                <div className="flex gap-2">
                  <button className="rounded-lg border border-slate-700 px-3 py-2 disabled:opacity-50" disabled={pagination.page <= 1} onClick={() => loadUsers(pagination.page - 1)} type="button">Previous</button>
                  <button className="rounded-lg border border-slate-700 px-3 py-2 disabled:opacity-50" disabled={pagination.page >= pagination.pages} onClick={() => loadUsers(pagination.page + 1)} type="button">Next</button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
