import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import useAuthStore from '../store/authStore';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://dev-api.carbontrackapp.com/api/v1';
const REFRESH_THRESHOLD_SECONDS = 30 * 60;

const refreshPromises = new Map();

const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

const refreshClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

const decodeJwtPayload = (token) => {
  try {
    return jwtDecode(token);
  } catch {
    return null;
  }
};

const shouldRefreshToken = (token) => {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) {
    return false;
  }
  const remainingSeconds = payload.exp - Math.floor(Date.now() / 1000);
  return remainingSeconds > 0 && remainingSeconds < REFRESH_THRESHOLD_SECONDS;
};

const refreshToken = async (token) => {
  if (!refreshPromises.has(token)) {
    const promise = refreshClient.post(
      '/auth/refresh',
      {},
      { headers: { Authorization: `Bearer ${token}` } },
    ).finally(() => {
      refreshPromises.delete(token);
    });
    refreshPromises.set(token, promise);
  }

  const response = await refreshPromises.get(token);
  const data = response.data?.data || {};
  if (data.token) {
    const currentToken = useAuthStore.getState().token;
    if (currentToken !== token) {
      return currentToken || token;
    }
    await useAuthStore.getState().setSession({
      token: data.token,
      user: data.user || useAuthStore.getState().user,
    });
    return data.token;
  }
  return token;
};

apiClient.interceptors.request.use(async (config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    let nextToken = token;
    if (shouldRefreshToken(token)) {
      try {
        nextToken = await refreshToken(token);
      } catch {
        nextToken = token;
      }
    }
    config.headers.Authorization = `Bearer ${nextToken}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  },
);

export default apiClient;
