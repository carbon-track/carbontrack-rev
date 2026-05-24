import Taro from '@tarojs/taro';

const TOKEN_KEY = 'carbontrack.auth.token';
const USER_KEY = 'carbontrack.auth.user';
const EMAIL_VERIFICATION_REQUIRED_KEY = 'carbontrack.auth.emailVerificationRequired';
const VERIFICATION_EMAIL_KEY = 'carbontrack.auth.verificationEmail';

const readJson = (key) => {
  const value = Taro.getStorageSync(key);
  if (!value) {
    return null;
  }
  if (typeof value === 'object') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

export const getToken = () => Taro.getStorageSync(TOKEN_KEY) || '';

export const getUser = () => readJson(USER_KEY);

export const getSession = () => {
  const token = getToken();
  const user = getUser();
  const requiresEmailVerification = Taro.getStorageSync(EMAIL_VERIFICATION_REQUIRED_KEY) === 'true';
  const verificationEmail = Taro.getStorageSync(VERIFICATION_EMAIL_KEY) || user?.email || '';

  return {
    token,
    user,
    isAuthenticated: Boolean(token && user),
    requiresEmailVerification: Boolean(token && user && requiresEmailVerification),
    verificationEmail,
  };
};

export const setSession = ({
  token,
  user,
  email_verification_required: emailVerificationRequired,
  preserve_email_verification_required: preserveEmailVerificationRequired,
}) => {
  if (token) {
    Taro.setStorageSync(TOKEN_KEY, token);
  }
  if (user) {
    Taro.setStorageSync(USER_KEY, JSON.stringify(user));
  }

  const current = getSession();
  const hasVerificationFlag = emailVerificationRequired !== undefined && emailVerificationRequired !== null;
  const requiresEmailVerification = hasVerificationFlag
    ? Boolean(emailVerificationRequired)
    : Boolean(preserveEmailVerificationRequired && current.requiresEmailVerification);
  const verificationEmail = requiresEmailVerification ? user?.email || current.verificationEmail || '' : '';

  if (requiresEmailVerification) {
    Taro.setStorageSync(EMAIL_VERIFICATION_REQUIRED_KEY, 'true');
    Taro.setStorageSync(VERIFICATION_EMAIL_KEY, verificationEmail);
  } else {
    Taro.removeStorageSync(EMAIL_VERIFICATION_REQUIRED_KEY);
    Taro.removeStorageSync(VERIFICATION_EMAIL_KEY);
  }
};

export const setToken = (token) => {
  if (token) {
    Taro.setStorageSync(TOKEN_KEY, token);
  } else {
    Taro.removeStorageSync(TOKEN_KEY);
  }
};

export const setUser = (user) => {
  if (user) {
    Taro.setStorageSync(USER_KEY, JSON.stringify(user));
  } else {
    Taro.removeStorageSync(USER_KEY);
  }
};

export const clearEmailVerificationRequired = () => {
  Taro.removeStorageSync(EMAIL_VERIFICATION_REQUIRED_KEY);
  Taro.removeStorageSync(VERIFICATION_EMAIL_KEY);
};

export const clearSession = () => {
  [
    TOKEN_KEY,
    USER_KEY,
    EMAIL_VERIFICATION_REQUIRED_KEY,
    VERIFICATION_EMAIL_KEY,
  ].forEach((key) => Taro.removeStorageSync(key));
};

export const isAuthenticated = () => getSession().isAuthenticated;

export const redirectToLogin = () => {
  const current = Taro.getCurrentPages?.()?.slice(-1)?.[0];
  if (current?.route === 'pages/login/index') {
    return;
  }
  Taro.reLaunch({ url: '/pages/login/index' });
};
