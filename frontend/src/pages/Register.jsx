import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Enter your name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await register({ name: name.trim(), email: email.trim(), password });
      navigate('/protected', { replace: true });
    } catch (requestError) {
      setError(requestError.message || 'Unable to create your account. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-slate-100">
      <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl shadow-black/20">
        <Link className="text-sm font-semibold tracking-[0.25em] text-cyan-300" to="/">RESTIFY</Link>
        <h1 className="mt-8 text-3xl font-semibold text-white">Create your account</h1>
        <p className="mt-2 mb-8 text-slate-400">Start with a secure RESTIFY account.</p>
        <form className="space-y-5" onSubmit={handleSubmit} noValidate>
          <Field id="name" label="Name" type="text" autoComplete="name" value={name} onChange={setName} />
          <Field id="email" label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} />
          <Field id="password" label="Password" type="password" autoComplete="new-password" value={password} onChange={setPassword} />
          <Field
            id="confirm-password"
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={setConfirmation}
          />
          {error && <p className="rounded-lg bg-rose-950/70 px-4 py-3 text-sm text-rose-200" role="alert">{error}</p>}
          <button
            className="w-full rounded-lg bg-cyan-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-400">
          Already registered? <Link className="font-medium text-cyan-300 hover:text-cyan-200" to="/login">Sign in</Link>
        </p>
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
