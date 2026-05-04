import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import useAuthStore from '../store/authStore';
import { mobileClientHeaders } from './mobileClientConfig';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://dev-api.carbontrackapp.com/api/v1';
const REFRESH_THRESHOLD_SECONDS = 10 * 60;
export const API_REQUEST_TIMEOUT_MS = 15000;
export const NETWORK_TIMEOUT_CODE = 'NETWORK_TIMEOUT';

const refreshPromises = new Map();

const apiClient = axios.create({
  baseURL: API_URL,
  headers: { Accept: 'application/json', ...mobileClientHeaders },
  timeout: API_REQUEST_TIMEOUT_MS,
  timeoutErrorMessage: NETWORK_TIMEOUT_CODE,
  transitional: { clarifyTimeoutError: true },
});

const refreshClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json', ...mobileClientHeaders },
  timeout: API_REQUEST_TIMEOUT_MS,
  timeoutErrorMessage: NETWORK_TIMEOUT_CODE,
  transitional: { clarifyTimeoutError: true },
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
      return currentToken;
    }
    await useAuthStore.getState().setSession({
      token: data.token,
      user: data.user || useAuthStore.getState().user,
      preserve_email_verification_required: true,
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
      } catch (error) {
        console.warn('Token refresh failed; continuing with current token.', error);
        nextToken = token;
      }
    }
    if (nextToken) {
      config.headers.Authorization = `Bearer ${nextToken}`;
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await useAuthStore.getState().logout();
    }
    throw error;
  },
);

export default apiClient;
