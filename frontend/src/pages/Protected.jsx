import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Protected() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    let notice;
    try {
      await logout();
    } catch {
      notice = 'The token was cleared on this device, but the logout request could not be confirmed.';
    } finally {
      navigate('/login', { replace: true, state: notice ? { notice } : undefined });
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12 text-slate-100">
      <section className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">RESTIFY</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Protected route</h1>
        <p className="mt-4 text-slate-300">
          You are signed in as <span className="font-medium text-white">{user?.name}</span> ({user?.email}).
        </p>
        <button
          className="mt-8 rounded-lg border border-slate-700 px-4 py-2 font-medium text-slate-100 transition hover:border-rose-400 hover:text-rose-200"
          onClick={handleLogout}
          type="button"
        >
          Sign out
        </button>
      </section>
    </main>
  );
}
