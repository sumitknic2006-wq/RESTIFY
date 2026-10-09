import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import userApi from '../services/userApi';

const DEFAULT_PREFERENCES = {
  theme: 'system',
  notifications: { achievements: true, challenges: true, goals: true },
};
const PreferencesContext = createContext(null);

function normalizePreferences(preferences) {
  return {
    theme: ['system', 'light', 'dark'].includes(preferences?.theme)
      ? preferences.theme
      : DEFAULT_PREFERENCES.theme,
    notifications: {
      ...DEFAULT_PREFERENCES.notifications,
      ...(preferences?.notifications || {}),
    },
  };
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme === 'system' ? 'light dark' : theme;
}

export function PreferencesProvider({ children }) {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const next = normalizePreferences(user?.preferences);
    setPreferences(next);
    applyTheme(next.theme);
  }, [user]);

  const updatePreferences = useCallback(async (patch) => {
    const next = normalizePreferences({
      ...preferences,
      ...patch,
      notifications: { ...preferences.notifications, ...(patch.notifications || {}) },
    });
    setSaving(true);
    setError('');
    try {
      const response = await userApi.updatePreferences(patch);
      const saved = normalizePreferences(response.data.preferences);
      setPreferences(saved);
      applyTheme(saved.theme);
      return saved;
    } catch (requestError) {
      setError(requestError.message || 'Could not save your preferences.');
      throw requestError;
    } finally {
      setSaving(false);
    }
  }, [preferences]);

  const value = useMemo(
    () => ({ preferences, saving, error, updatePreferences }),
    [preferences, saving, error, updatePreferences]
  );
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('usePreferences must be used within a PreferencesProvider.');
  return context;
}
