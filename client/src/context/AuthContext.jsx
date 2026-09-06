import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (u) => {
    try {
      const { data } = await api.get('/auth/me');
      const enriched = { ...(u || data), ...data };
      localStorage.setItem('user', JSON.stringify(enriched));
      return enriched;
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        return null;
      }
      return u;
    }
  };

  // On mount: refresh profile so retailer/supplier IDs are always current
  useEffect(() => {
    (async () => {
      if (localStorage.getItem('token')) {
        const stored = localStorage.getItem('user');
        const base = stored ? JSON.parse(stored) : null;
        const fresh = await fetchProfile(base);
        setUser(fresh);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    const profile = await fetchProfile(data.user);
    setUser(profile);
    return profile;
  };

  const register = async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    localStorage.setItem('token', data.token);
    const profile = await fetchProfile(data.user);
    setUser(profile);
    return profile;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, fetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);