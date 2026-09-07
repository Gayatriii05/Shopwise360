import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/client';
import { getAccessToken, getUser, setSession, clearSession } from '../api/authStorage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getUser());
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (u) => {
    try {
      const { data } = await api.get('/auth/me');
      const enriched = { ...(u || data), ...data };
      setSession({ accessToken: null, refreshToken: null, user: enriched });
      return enriched;
    } catch (err) {
      if (err.response?.status === 401) {
        clearSession();
        return null;
      }
      return u;
    }
  };

  // On mount: refresh profile so retailer/supplier IDs are always current
  useEffect(() => {
    (async () => {
      if (getAccessToken()) {
        const fresh = await fetchProfile(getUser());
        setUser(fresh);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    setSession({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user });
    const profile = await fetchProfile(data.user);
    setUser(profile);
    return profile;
  };

  const register = async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    setSession({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user });
    const profile = await fetchProfile(data.user);
    setUser(profile);
    return profile;
  };

  const logout = async () => {
    try {
      const { getRefreshToken } = await import('../api/authStorage');
      await api.post('/auth/logout', { refreshToken: getRefreshToken() });
    } catch {
      // Server-side revoke is best-effort; local state is always cleared.
    }
    clearSession();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, fetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);