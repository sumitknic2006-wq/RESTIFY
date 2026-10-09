import { Link, Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api, { API_URL } from './services/api';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import { PreferencesProvider } from './context/PreferencesContext';
import FocusMode from './pages/FocusMode';
import AdminDashboard from './pages/AdminDashboard';
import { useAuth } from './context/AuthContext';

function AdminRoute() {
  const { user } = useAuth();
  if (user?.role !== 'admin') {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-5 text-slate-100">
        <section className="max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center">
          <h1 className="text-2xl font-semibold text-white">Administrator access required</h1>
          <p className="mt-2 text-sm text-slate-400">This area is available only to authorized administrators.</p>
          <Link className="mt-5 inline-block rounded-lg border border-slate-700 px-4 py-2 text-sm hover:border-cyan-400" to="/dashboard">Back to dashboard</Link>
        </section>
      </main>
    );
  }
  return <AdminDashboard />;
}

function ConnectionStatus() {
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Checking backend connection...');

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await api.getHealth();
        setStatus('success');
        setMessage(response.message || 'RESTIFY backend is running');
      } catch (error) {
        setStatus('error');
        setMessage('Unable to connect to the RESTIFY backend. Please make sure the backend server is running.');
      }
    };

    checkHealth();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6 py-10">
        <div className="w-full rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/40 backdrop-blur-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">RESTIFY</p>
              <h1 className="mt-2 text-3xl font-semibold text-white">Backend Connection</h1>
            </div>
            <div
              className={`flex h-4 w-4 rounded-full ${
                status === 'success'
                  ? 'bg-emerald-400'
                  : status === 'error'
                    ? 'bg-rose-400'
                    : 'bg-amber-400 animate-pulse'
              }`}
            />
          </div>

          <div className="space-y-4">
            <p className="text-lg text-slate-200">
              {status === 'loading' && 'Checking backend connection...'}
              {status === 'success' && 'Connected'}
              {status === 'error' && 'Disconnected'}
            </p>

            <p className="text-base text-slate-300">
              {message}
            </p>

            <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-4 text-sm text-slate-300">
              <span className="font-medium text-slate-100">Backend:</span> {API_URL}
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link className="rounded-lg bg-cyan-400 px-4 py-2 font-medium text-slate-950 hover:bg-cyan-300" to="/login">Sign in</Link>
              <Link className="rounded-lg border border-slate-700 px-4 py-2 font-medium text-slate-100 hover:border-cyan-400" to="/register">Create account</Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PreferencesProvider>
        <Routes>
          <Route path="/" element={<ConnectionStatus />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/protected" element={<Dashboard />} />
            <Route path="/focus" element={<FocusMode />} />
            <Route path="/admin" element={<AdminRoute />} />
          </Route>
        </Routes>
      </PreferencesProvider>
    </AuthProvider>
  );
}
