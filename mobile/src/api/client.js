import axios from 'axios';
import * as Crypto from 'expo-crypto';
import { jwtDecode } from 'jwt-decode';
import useAuthStore from '../store/authStore';
import { mobileClientHeaders } from './mobileClientConfig';

const resolveApiUrl = () => {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL;
  if (typeof configuredUrl === 'string' && configuredUrl.trim()) {
    return configuredUrl.trim();
  }
  throw new Error('EXPO_PUBLIC_API_URL must be configured with the backend API base URL');
};

const API_URL = resolveApiUrl();
const REFRESH_THRESHOLD_SECONDS = 30 * 60;
const IDEMPOTENT_METHODS = new Set(['post', 'put', 'patch']);
export const API_REQUEST_TIMEOUT_MS = 15000;
export const NETWORK_TIMEOUT_CODE = 'NETWORK_TIMEOUT';

const refreshPromises = new Map();

const generateRequestId = () => {
  if (typeof Crypto.randomUUID === 'function') {
    return Crypto.randomUUID();
  }

  const bytes = Crypto.getRandomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const ensureRequestId = (config) => {
  const method = String(config.method || 'get').toLowerCase();
  if (!IDEMPOTENT_METHODS.has(method)) {
    return;
  }

  config.headers = config.headers || {};
  if (!config.headers['X-Request-ID'] && !config.headers['x-request-id']) {
    config.headers['X-Request-ID'] = generateRequestId();
  }
};

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
  return remainingSeconds <= REFRESH_THRESHOLD_SECONDS;
};

const isAuthRefreshFailure = (error) => error?.response?.status === 401;

const refreshToken = async (token, refreshTokenValue = null) => {
  const refreshKey = refreshTokenValue || token;
  if (!refreshKey) {
    return null;
  }

  if (!refreshPromises.has(refreshKey)) {
    const requestConfig = token ? { headers: { Authorization: `Bearer ${token}` } } : undefined;
    const requestBody = refreshTokenValue ? { refresh_token: refreshTokenValue } : {};
    const promise = refreshClient.post('/auth/refresh', requestBody, requestConfig).finally(() => {
      refreshPromises.delete(refreshKey);
    });
    refreshPromises.set(refreshKey, promise);
  }

  const response = await refreshPromises.get(refreshKey);
  const data = response.data?.data || {};
  if (data.token) {
    const currentToken = useAuthStore.getState().token;
    const currentRefreshToken = useAuthStore.getState().refreshToken;
    if (token && currentToken !== token && (!refreshTokenValue || currentRefreshToken !== refreshTokenValue)) {
      return currentToken;
    }
    await useAuthStore.getState().setSession({
      token: data.token,
      refresh_token: data.refresh_token || refreshTokenValue,
      user: data.user || useAuthStore.getState().user,
      preserve_email_verification_required: true,
    });
    return data.token;
  }
  return token;
};

export const ensureFreshAuthToken = async ({ force = false, logoutOnFailure = false } = {}) => {
  const token = useAuthStore.getState().token;
  const refreshTokenValue = useAuthStore.getState().refreshToken;
  if (!token && !refreshTokenValue) {
    return null;
  }

  if (token && !force && !shouldRefreshToken(token)) {
    return token;
  }

  try {
    return await refreshToken(token, refreshTokenValue);
  } catch (error) {
    if (logoutOnFailure && isAuthRefreshFailure(error) && useAuthStore.getState().token === token) {
      await useAuthStore.getState().logout();
    }
    throw error;
  }
};

apiClient.interceptors.request.use(async (config) => {
  ensureRequestId(config);

  if (config.skipAuthRefresh) {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  }

  const token = useAuthStore.getState().token;
  if (token) {
    let nextToken = token;
    try {
      nextToken = await ensureFreshAuthToken();
    } catch (error) {
      console.warn('Token refresh failed; continuing with current token.', {
        status: error?.response?.status ?? null,
        code: error?.response?.data?.code ?? error?.code ?? null,
        message: error?.response?.data?.message ?? error?.message ?? 'unknown',
      });
      nextToken = token;
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
    const originalConfig = error.config;
    const isRefreshRequest = originalConfig?.url === '/auth/refresh';

    if (error.response?.status === 401 && originalConfig && !originalConfig._authRefreshRetry && !isRefreshRequest) {
      originalConfig._authRefreshRetry = true;
      const token = useAuthStore.getState().token;
      const refreshTokenValue = useAuthStore.getState().refreshToken;
      if (token || refreshTokenValue) {
        try {
          const nextToken = await refreshToken(token, refreshTokenValue);
          if (nextToken) {
            originalConfig.headers = originalConfig.headers || {};
            originalConfig.headers.Authorization = `Bearer ${nextToken}`;
            return apiClient(originalConfig);
          }
        } catch (refreshError) {
          if (isAuthRefreshFailure(refreshError) && useAuthStore.getState().token === token) {
            await useAuthStore.getState().logout();
          }
        }
      }
    }
    throw error;
  },
);

export default apiClient;
