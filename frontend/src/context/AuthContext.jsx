import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import authApi from '../services/authApi';
import { clearToken, getToken, setToken } from '../services/tokenStorage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      try {
        if (!getToken()) return;
        const response = await authApi.me();
        if (active) setUser(response.data.user);
      } catch (error) {
        if (error.status === 401) {
          clearToken();
          if (active) setSessionError('Your session has expired. Please sign in again.');
        } else if (active) {
          setSessionError('Unable to restore your session. Check your connection and sign in.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    restoreSession();
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const response = await authApi.login(credentials);
    const { token, user: authenticatedUser } = response.data;
    setToken(token);
    setUser(authenticatedUser);
    setSessionError('');
    return authenticatedUser;
  }, []);

  const register = useCallback(async (details) => {
    const response = await authApi.register(details);
    const { token, user: authenticatedUser } = response.data;
    setToken(token);
    setUser(authenticatedUser);
    setSessionError('');
    return authenticatedUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearToken();
      setUser(null);
      setSessionError('');
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      sessionError,
      isAuthenticated: Boolean(user),
      login,
      register,
      logout,
    }),
    [user, loading, sessionError, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return context;
}
