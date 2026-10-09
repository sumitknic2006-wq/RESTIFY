import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login, sessionError } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(location.state?.notice || '');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (!password) {
      setError('Enter your password.');
      return;
    }

    setLoading(true);
    try {
      await login({ email: email.trim(), password });
      navigate(location.state?.from?.pathname || '/protected', { replace: true });
    } catch (requestError) {
      setError(requestError.message || 'Unable to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthPage title="Welcome back" subtitle="Sign in to your RESTIFY account.">
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
        />
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
        />
        {(error || sessionError) && (
          <p className="rounded-lg bg-rose-950/70 px-4 py-3 text-sm text-rose-200" role="alert">
            {error || sessionError}
          </p>
        )}
        <button
          className="w-full rounded-lg bg-cyan-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          disabled={loading}
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-400">
        New to RESTIFY? <Link className="font-medium text-cyan-300 hover:text-cyan-200" to="/register">Create an account</Link>
      </p>
    </AuthPage>
  );
}

function AuthPage({ title, subtitle, children }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-slate-100">
      <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl shadow-black/20">
        <Link className="text-sm font-semibold tracking-[0.25em] text-cyan-300" to="/">RESTIFY</Link>
        <h1 className="mt-8 text-3xl font-semibold text-white">{title}</h1>
        <p className="mt-2 mb-8 text-slate-400">{subtitle}</p>
        {children}
      </section>
    </main>
  );
}

function Field({ id, label, type, autoComplete, value, onChange }) {
  return (
    <label className="block text-sm font-medium text-slate-200" htmlFor={id}>
      {label}
      <input
        className="mt-2 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      />
    </label>
  );
}
