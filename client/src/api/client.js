import axios from 'axios';
import { getAccessToken, getRefreshToken, setSession, getUser, clearSession, redirectToLogin } from './authStorage';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Single-flight refresh: parallel 401s share one /auth/refresh call.
let refreshing = null;

async function refreshSession() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  refreshing = refreshing || api
    .post('/auth/refresh', { refreshToken })
    .then(({ data }) => {
      setSession({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: getUser() });
      return data.accessToken;
    })
    .catch(() => {
      clearSession();
      return null;
    })
    .finally(() => { refreshing = null; });
  return refreshing;
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { config, response } = error;
    const url = config?.url || '';
    const isAuthCall = /\/auth\/(login|register|refresh|logout)/.test(url);
    if (response?.status === 401 && config && !config._retried && !isAuthCall) {
      config._retried = true;
      const newToken = await refreshSession();
      if (newToken) {
        config.headers.Authorization = `Bearer ${newToken}`;
        return api(config);
      }
      redirectToLogin();
    }
    return Promise.reject(error);
  }
);

export { refreshSession };

export async function downloadFile(url, filename) {
  const { data } = await api.get(url, { responseType: 'blob' });
  const blobUrl = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(blobUrl);
}

export default api;