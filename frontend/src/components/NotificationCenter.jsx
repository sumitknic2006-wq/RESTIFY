import { useCallback, useEffect, useState } from 'react';
import notificationApi from '../services/notificationApi';

function relativeTime(value) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 'Recently';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(value).toLocaleDateString();
}

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const refresh = useCallback(async () => {
    try {
      const response = await notificationApi.list();
      setItems(response.data.notifications);
      setUnreadCount(response.data.unreadCount);
      setError('');
    } catch {
      setError('Notifications could not be loaded. Check your connection and retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 60000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  async function markRead(id) {
    setBusyId(id);
    try {
      await notificationApi.markRead(id);
      await refresh();
    } catch {
      setError('Could not update this notification. Please retry.');
    } finally {
      setBusyId('');
    }
  }

  async function dismiss(id) {
    setBusyId(id);
    try {
      await notificationApi.dismiss(id);
      await refresh();
    } catch {
      setError('Could not dismiss this notification. Please retry.');
    } finally {
      setBusyId('');
    }
  }

  async function markAllRead() {
    setBusyId('all');
    try {
      await notificationApi.markAllRead();
      await refresh();
    } catch {
      setError('Could not mark notifications as read. Please retry.');
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="relative">
      <button
        aria-expanded={open}
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        className="relative rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        Notifications
        {unreadCount > 0 && (
          <span className="ml-2 rounded-full bg-cyan-400 px-1.5 py-0.5 text-xs font-bold text-slate-950">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <section
          aria-label="Notifications"
          className="absolute right-0 z-30 mt-2 w-[min(92vw,24rem)] rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-semibold text-white">Notifications</h2>
            <button
              className="text-xs text-cyan-300 hover:text-cyan-200 disabled:opacity-50"
              disabled={!unreadCount || busyId === 'all'}
              onClick={markAllRead}
              type="button"
            >
              Mark all read
            </button>
          </div>
          {loading ? (
            <p className="py-5 text-center text-sm text-slate-400" role="status">Loading notifications…</p>
          ) : error ? (
            <div>
              <p className="text-sm text-rose-200" role="alert">{error}</p>
              <button className="mt-2 text-sm text-cyan-300" onClick={refresh} type="button">Retry</button>
            </div>
          ) : items.length === 0 ? (
            <p className="py-5 text-center text-sm text-slate-400">You’re all caught up. New achievement and challenge updates will appear here.</p>
          ) : (
            <ul className="max-h-96 space-y-2 overflow-y-auto">
              {items.map((item) => (
                <li className={`rounded-xl border p-3 ${item.readAt ? 'border-slate-800 bg-slate-950/50' : 'border-cyan-800 bg-cyan-950/30'}`} key={item.id}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-white">{item.title}</p>
                    <time className="shrink-0 text-[11px] text-slate-500" dateTime={item.createdAt}>{relativeTime(item.createdAt)}</time>
                  </div>
                  <p className="mt-1 text-sm text-slate-300">{item.message}</p>
                  <div className="mt-2 flex gap-3">
                    {!item.readAt && <button className="text-xs text-cyan-300 disabled:opacity-50" disabled={busyId === item.id} onClick={() => markRead(item.id)} type="button">Mark read</button>}
                    <button className="text-xs text-slate-400 disabled:opacity-50" disabled={busyId === item.id} onClick={() => dismiss(item.id)} type="button">Dismiss</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
