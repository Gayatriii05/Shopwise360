const KEYS = { access: 'token', refresh: 'refreshToken', user: 'user' };

export const getAccessToken = () => localStorage.getItem(KEYS.access);
export const getRefreshToken = () => localStorage.getItem(KEYS.refresh);
export const getUser = () => {
  const stored = localStorage.getItem(KEYS.user);
  try {
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

export function setSession({ accessToken, refreshToken, user }) {
  if (accessToken) localStorage.setItem(KEYS.access, accessToken);
  if (refreshToken) localStorage.setItem(KEYS.refresh, refreshToken);
  if (user) localStorage.setItem(KEYS.user, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(KEYS.access);
  localStorage.removeItem(KEYS.refresh);
  localStorage.removeItem(KEYS.user);
}

export function redirectToLogin() {
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}