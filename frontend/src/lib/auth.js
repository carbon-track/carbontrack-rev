import { safeReturnPath } from './safeReturn';

const DEV_AUTH_TRUTHY_VALUES = new Set(['1', 'true', 'yes', 'on']);

let apiPromise;
let tokenRefreshPromise = null;

const TOKEN_REFRESH_THRESHOLD_MS = 10 * 60 * 1000;
const TOKEN_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const getApi = async () => {
  if (!apiPromise) {
    apiPromise = import('./api').then((module) => module.default);
  }

  return apiPromise;
};

const isDevTruthy = (value) => DEV_AUTH_TRUTHY_VALUES.has(String(value || '').toLowerCase());

const decodeBase64Utf8 = (rawBase64) => {
  const normalized = String(rawBase64 || '').trim().replaceAll('-', '+').replaceAll('_', '/');
  const paddingLength = normalized.length % 4;
  const padded = paddingLength ? normalized + '='.repeat(4 - paddingLength) : normalized;
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.codePointAt(0) ?? 0);

  if (globalThis.TextDecoder) {
    return new globalThis.TextDecoder('utf-8').decode(bytes);
  }

  return binary;
};

const decodeJwtPayload = (token) => {
  const [, payload] = String(token || '').split('.');
  if (!payload) {
    return null;
  }

  return JSON.parse(decodeBase64Utf8(payload));
};

const getTokenRemainingMs = (token) => {
  try {
    const payload = decodeJwtPayload(token);
    if (!payload?.exp) {
      return 0;
    }

    return payload.exp * 1000 - Date.now();
  } catch {
    return 0;
  }
};

const shouldRefreshToken = (token) => {
  const remainingTime = getTokenRemainingMs(token);
  return remainingTime > 0 && remainingTime < TOKEN_REFRESH_THRESHOLD_MS;
};

const isRefreshRequest = (url = '') => String(url).includes('/auth/refresh');

const hasMinimalDevUserInfoFields = (userInfo) => (
  userInfo
  && typeof userInfo === 'object'
  && !Array.isArray(userInfo)
  && userInfo.id != null
);

export const hasSupportPortalAccess = (user) => Boolean(
  user?.is_admin
  || user?.is_support
  || user?.role === 'support'
  || user?.role === 'admin'
);

const parseDevUserInfoFromEnv = () => {
  const rawJson = String(import.meta.env?.VITE_DEV_AUTH_USER_INFO_JSON || '').trim();
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      console.warn('Failed to parse VITE_DEV_AUTH_USER_INFO_JSON:', error);
    }
  }

  const rawBase64 = String(import.meta.env?.VITE_DEV_AUTH_USER_INFO_BASE64 || '').trim();
  if (rawBase64) {
    try {
      const decodedJson = decodeBase64Utf8(rawBase64);
      const parsed = JSON.parse(decodedJson);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      console.warn('Failed to parse VITE_DEV_AUTH_USER_INFO_BASE64:', error);
    }
  }

  return null;
};

// Token管理
export const tokenManager = {
  getToken() {
    return localStorage.getItem('auth_token');
  },

  setToken(token) {
    localStorage.setItem('auth_token', token);
  },

  removeToken() {
    localStorage.removeItem('auth_token');
  },

  isTokenValid() {
    const token = this.getToken();
    if (!token) return false;

    try {
      return getTokenRemainingMs(token) > 0;
    } catch {
      return false;
    }
  },

  getTokenRemainingMs() {
    return getTokenRemainingMs(this.getToken());
  },

  shouldRefresh() {
    return shouldRefreshToken(this.getToken());
  }
};

// 用户管理
export const userManager = {
  getUser() {
    const userStr = localStorage.getItem('user_info');
    return userStr ? JSON.parse(userStr) : null;
  },

  setUser(user) {
    if (!user) {
      this.removeUser();
      return;
    }
    
    const existing = this.getUser();
    const existingId = existing?.id;
    const nextUserId = user?.id;
    const isSameUser = existingId != null && nextUserId != null && String(existingId) === String(nextUserId);
    
    // UUID should only come from the backend database/identity layer.
    // If the new data contains a UUID, use it.
    // If not, but it is the same user, preserve the existing one.
    // Never generate a fake UUID on the client side.
    const uuid = user.uuid || (isSameUser ? existing.uuid : null);

    const mergedUser = isSameUser ? {
      ...existing,
      ...user
    } : {
      ...user
    };
    
    if (uuid && uuid !== 'null') {
      mergedUser.uuid = uuid;
    } else {
      delete mergedUser.uuid;
    }
    
    localStorage.setItem('user_info', JSON.stringify(mergedUser));
  },

  removeUser() {
    localStorage.removeItem('user_info');
  },

  isAdmin() {
    const user = this.getUser();
    return user?.is_admin || false;
  },

  isSupport() {
    return hasSupportPortalAccess(this.getUser());
  }
};

export const getDefaultAuthenticatedRoute = (user = userManager.getUser()) => (
  hasSupportPortalAccess(user) ? '/support/' : '/dashboard'
);

export const bootstrapDevAuthFromEnv = () => {
  if (!import.meta.env.DEV || !isDevTruthy(import.meta.env?.VITE_ENABLE_DEV_AUTH_FROM_ENV)) {
    return false;
  }

  if (globalThis.localStorage === undefined) {
    return false;
  }

  const envToken = String(import.meta.env?.VITE_DEV_AUTH_TOKEN || '').trim();
  const envUserInfo = parseDevUserInfoFromEnv();

  if (!envToken || !hasMinimalDevUserInfoFields(envUserInfo)) {
    if (envToken || envUserInfo) {
      console.warn(
        '[bootstrapDevAuthFromEnv] Invalid dev auth env payload; requires VITE_DEV_AUTH_TOKEN and user_info with at least "id". Injection skipped.'
      );
    }
    return false;
  }

  const forceSync = isDevTruthy(import.meta.env?.VITE_DEV_AUTH_FORCE_SYNC);
  const existingToken = tokenManager.getToken();
  const existingUser = userManager.getUser();

  if (!forceSync && existingToken && existingUser) {
    return false;
  }

  tokenManager.setToken(envToken);
  userManager.setUser(envUserInfo);

  return true;
};

export const refreshAuthToken = async () => {
  const token = tokenManager.getToken();
  if (!token || !tokenManager.isTokenValid()) {
    throw new Error('Cannot refresh a missing or expired token');
  }

  if (tokenRefreshPromise?.token === token) {
    return tokenRefreshPromise.promise;
  }

  const refreshEntry = {
    token,
    promise: (async () => {
      const api = await getApi();
      const response = await api.post('/auth/refresh');
      const responseData = response.data;
      const { token: nextToken, user } = responseData?.data || {};

      if (!responseData?.success || !nextToken) {
        throw new Error(responseData?.message || 'Token refresh failed');
      }

      if (tokenManager.getToken() !== token) {
        return responseData;
      }

      tokenManager.setToken(nextToken);
      if (user) {
        userManager.setUser(user);
      }

      return responseData;
    })(),
  };
  tokenRefreshPromise = refreshEntry;

  try {
    return await refreshEntry.promise;
  } finally {
    if (tokenRefreshPromise === refreshEntry) {
      tokenRefreshPromise = null;
    }
  }
};

// 认证API (注意：这些方法也在 api.js 中的 authAPI 对象中定义了，建议统一使用)
export const authAPI = {
  async login(credentials) {
    const api = await getApi();
    const response = await api.post('/auth/login', credentials);
    
    if (response.data.success) {
      const { token, user } = response.data.data;
      tokenManager.setToken(token);
      userManager.setUser(user);
    }
    
    return response.data;
  },

  async loginWithPasskey(data) {
    const api = await getApi();
    const response = await api.post('/auth/passkey/login/verify', data);
    
    if (response.data.success) {
      const { token, user } = response.data.data;
      tokenManager.setToken(token);
      userManager.setUser(user);
    }
    
    return response.data;
  },

  async register(userData) {
    const api = await getApi();
    const response = await api.post('/auth/register', userData);
    
    if (response.data.success && response.data.data) {
      const { token, user } = response.data.data;
      if (token) {
        tokenManager.setToken(token);
      }
      if (user) {
        userManager.setUser(user);
      }
    }
    
    return response.data;
  },

  async logout() {
    try {
      const api = await getApi();
      await api.post('/auth/logout');
    } catch (error) {
      console.warn('Logout API call failed:', error);
    } finally {
      tokenManager.removeToken();
      userManager.removeUser();
    }
  },

  async refresh() {
    return refreshAuthToken();
  },

  async getCurrentUser() {
    try {
      const api = await getApi();
      const response = await api.get('/users/me');
      if (response.data.success) {
        userManager.setUser(response.data.data);
        return response.data.data;
      }
    } catch (error) {
      console.error('Get current user failed:', error);
      this.logout();
    }
    return null;
  },

  async forgotPassword(payload) {
    const api = await getApi();
    const body = typeof payload === 'string' ? { email: payload } : payload;
    const response = await api.post('/auth/forgot-password', body);
    return response.data;
  },

  async resetPassword(token, password, confirmPassword) {
    const api = await getApi();
    const response = await api.post('/auth/reset-password', {
      token,
      password,
      confirm_password: confirmPassword
    });
    return response.data;
  },

  async changePassword(currentPassword, newPassword, confirmPassword) {
    const api = await getApi();
    const response = await api.post('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
      confirm_password: confirmPassword
    });
    return response.data;
  },

  async sendVerificationCode(payload) {
    const api = await getApi();
    const body = typeof payload === 'string' ? { email: payload } : payload;
    const response = await api.post('/auth/send-verification-code', body);
    return response.data;
  },

  async verifyEmail(data) {
    const api = await getApi();
    const response = await api.post('/auth/verify-email', data);
    if (response.data?.success && response.data?.data) {
      const { token, user } = response.data.data;
      if (token) {
        tokenManager.setToken(token);
      }
      if (user) {
        userManager.setUser(user);
      }
    }
    return response.data;
  }
};

// 认证状态检查
export const checkAuthStatus = () => {
  const token = tokenManager.getToken();
  const user = userManager.getUser();
  
  // 需要 token 有效 且 本地有用户信息 才视为已登录
  if (!token || !tokenManager.isTokenValid()) {
    tokenManager.removeToken();
    userManager.removeUser();
    return { isAuthenticated: false, user: null };
  }
  if (!user) {
    return { isAuthenticated: false, user: null };
  }
  
  return { isAuthenticated: true, user };
};

// 登录重定向
export const redirectToLogin = (returnUrl = null) => {
  const url = returnUrl ? `/auth/login?return=${encodeURIComponent(returnUrl)}` : '/auth/login';
  window.location.href = url;
};

// 获取返回URL
export const getReturnUrl = () => {
  const params = new URLSearchParams(window.location.search);
  const fallback = getDefaultAuthenticatedRoute();
  const raw = params.get('return');
  if (raw === null || raw === undefined) {
    return fallback;
  }
  return safeReturnPath(raw, fallback);
};

// 权限检查
export const hasPermission = (permission) => {
  const user = userManager.getUser();
  if (!user) return false;
  
  // 管理员拥有所有权限
  if (user.is_admin) return true;
  
  // 基础权限检查
  const permissions = {
    'view_own_data': true,
    'edit_own_profile': true,
    'submit_carbon_record': true,
    'exchange_products': true,
    'view_messages': true
  };
  
  return permissions[permission] || false;
};

export const isSupportUser = () => userManager.isSupport();

// 表单验证规则
export const validationRules = {
  username: {
    required: '用户名不能为空',
    minLength: { value: 3, message: '用户名至少3个字符' },
    maxLength: { value: 20, message: '用户名最多20个字符' },
    pattern: {
      value: /^[a-zA-Z0-9_]+$/,
      message: '用户名只能包含字母、数字和下划线'
    }
  },
  
  email: {
    required: '邮箱不能为空',
    pattern: {
      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      message: '请输入有效的邮箱地址'
    }
  },
  
  password: {
    required: '密码不能为空',
    minLength: { value: 8, message: '密码至少8个字符' }
    // 已移除强制大小写+数字组合要求
  }
};

// 动态获取验证规则（向后兼容旧调用）
export const getValidationRules = () => {
  return {
    ...validationRules,
    // 登录时用户名或邮箱字段
    usernameOrEmail: {
      required: '用户名或邮箱不能为空',
      validate: (value) => {
        if (!value) return '用户名或邮箱不能为空';
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        const isUsername = /^[a-zA-Z0-9_]{3,20}$/.test(value);
        if (!isEmail && !isUsername) return '请输入有效的用户名或邮箱';
        return true;
      }
    }
  };
};

// 错误处理
export const handleAuthError = (error) => {
  if (error.response?.status === 401) {
    tokenManager.removeToken();
    userManager.removeUser();
    redirectToLogin(window.location.pathname);
    return;
  }
  
  const message = error.response?.data?.message || error.message || '操作失败';
  throw new Error(message);
};

// 自动刷新token
export const setupTokenRefresh = () => {
  const refreshIfNeeded = async () => {
    const token = tokenManager.getToken();
    if (!token || !tokenManager.isTokenValid()) {
      return;
    }
    
    try {
      if (shouldRefreshToken(token)) {
        await refreshAuthToken();
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      authAPI.logout();
    }
  };

  refreshIfNeeded();
  return setInterval(refreshIfNeeded, TOKEN_REFRESH_INTERVAL_MS);
};

// 初始化认证
export const initAuth = async () => {
  const api = await getApi();

  api.interceptors.request.use(async (config) => {
    const token = tokenManager.getToken();
    if (token) {
      if (!isRefreshRequest(config.url) && shouldRefreshToken(token)) {
        try {
          await refreshAuthToken();
        } catch (error) {
          console.warn('Token refresh failed; continuing with the current valid token:', error);
        }
      }

      const currentToken = tokenManager.getToken();
      config.headers.Authorization = `Bearer ${currentToken || token}`;
    }
    return config;
  });

  api.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        authAPI.logout();
        redirectToLogin();
      }
      return Promise.reject(error);
    }
  );

  setupTokenRefresh();
};

export default {
  tokenManager,
  userManager,
  authAPI,
  checkAuthStatus,
  redirectToLogin,
  getDefaultAuthenticatedRoute,
  getReturnUrl,
  hasPermission,
  isSupportUser,
  validationRules,
  getValidationRules,
  handleAuthError,
  initAuth
};

