import Taro from '@tarojs/taro';
import * as clientCoreModule from './clientCore.cjs';
import {
  clearSession,
  getSession,
  getToken,
  redirectToLogin,
  setSession,
} from '../store/session';

const clientCore = clientCoreModule.default || clientCoreModule;
const {
  buildRequestHeaders,
  createRequestId,
  shouldLogoutForStatus,
  shouldRefreshToken,
} = clientCore;

const REQUEST_TIMEOUT_MS = 15000;
const MOBILE_CLIENT_TYPE = 'mobile';
let refreshPromise = null;

const getEnv = () => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env;
  }
  return {};
};

export const resolveApiUrl = () => {
  const apiUrl = (getEnv().TARO_APP_API_URL || '').trim();
  if (!apiUrl) {
    throw new Error('TARO_APP_API_URL must be configured with the backend API base URL');
  }
  return apiUrl.replace(/\/+$/, '');
};

export const getMobileClientToken = () => (getEnv().TARO_APP_MOBILE_CLIENT_TOKEN || '').trim();

export const requireMobileClientToken = () => {
  const token = getMobileClientToken();
  if (!token) {
    const error = new Error('TARO_APP_MOBILE_CLIENT_TOKEN is not configured.');
    error.code = 'MOBILE_CLIENT_TOKEN_MISSING';
    throw error;
  }
  return token;
};

const buildUrl = (path) => `${resolveApiUrl()}${path.startsWith('/') ? path : `/${path}`}`;

const parseUploadBody = (data) => {
  if (typeof data !== 'string') {
    return data;
  }
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
};

export const getErrorMessage = (error, fallback = '请求失败，请稍后重试') => (
  error?.data?.message
  || error?.data?.error
  || error?.message
  || fallback
);

const createHttpError = (response, fallback) => {
  const body = parseUploadBody(response?.data);
  const message = body?.message || body?.error || fallback || `HTTP ${response?.statusCode || 0}`;
  const error = new Error(message);
  error.statusCode = response?.statusCode || 0;
  error.data = body;
  return error;
};

const assertOkResponse = (response) => {
  const statusCode = response?.statusCode || 0;
  const body = parseUploadBody(response?.data);
  if (shouldLogoutForStatus(statusCode)) {
    clearSession();
    redirectToLogin();
    throw createHttpError({ ...response, data: body }, '登录已过期，请重新登录');
  }
  if (statusCode < 200 || statusCode >= 300 || body?.success === false) {
    throw createHttpError({ ...response, data: body }, '请求失败');
  }
  return body;
};

const refreshToken = async (token) => {
  if (!refreshPromise) {
    const headers = buildRequestHeaders({
      token,
      mobileClientToken: getMobileClientToken(),
      requestId: createRequestId(),
    });
    refreshPromise = Taro.request({
      url: buildUrl('/auth/refresh'),
      method: 'POST',
      data: {},
      header: headers,
      timeout: REQUEST_TIMEOUT_MS,
    }).then((response) => {
      const body = assertOkResponse(response);
      const data = body?.data || {};
      if (data.token) {
        setSession({
          token: data.token,
          user: data.user || getSession().user,
          preserve_email_verification_required: true,
        });
        return data.token;
      }
      return token;
    }).finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
};

const getFreshToken = async (auth) => {
  if (auth === false) {
    return '';
  }
  const token = getToken();
  if (!token || !shouldRefreshToken(token)) {
    return token;
  }
  try {
    return await refreshToken(token);
  } catch {
    return token;
  }
};

export const request = async (path, options = {}) => {
  const method = (options.method || 'GET').toUpperCase();
  const shouldAttachRequestId = ['POST', 'PUT', 'PATCH'].includes(method);
  const token = await getFreshToken(options.auth);
  const headers = {
    ...buildRequestHeaders({
      token,
      mobileClientToken: getMobileClientToken(),
      requestId: shouldAttachRequestId ? createRequestId() : undefined,
      contentType: options.contentType === undefined ? 'application/json' : options.contentType,
    }),
    ...(options.header || {}),
  };

  const response = await Taro.request({
    url: buildUrl(path),
    method,
    data: options.data || {},
    header: headers,
    timeout: REQUEST_TIMEOUT_MS,
  });

  return assertOkResponse(response);
};

export const uploadFile = async (path, options = {}) => {
  const token = await getFreshToken(options.auth);
  const headers = {
    ...buildRequestHeaders({
      token,
      mobileClientToken: getMobileClientToken(),
      requestId: createRequestId(),
      contentType: null,
    }),
    ...(options.header || {}),
  };

  const response = await Taro.uploadFile({
    url: buildUrl(path),
    filePath: options.filePath,
    name: options.name || 'image',
    formData: options.formData || {},
    header: headers,
    timeout: REQUEST_TIMEOUT_MS,
  });

  return assertOkResponse(response);
};

const apiClient = {
  get: (path, params = {}, options = {}) => request(path, { ...options, method: 'GET', data: params }),
  post: (path, data = {}, options = {}) => request(path, { ...options, method: 'POST', data }),
  put: (path, data = {}, options = {}) => request(path, { ...options, method: 'PUT', data }),
  uploadFile,
};

export { MOBILE_CLIENT_TYPE };
export default apiClient;
