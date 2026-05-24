const REFRESH_THRESHOLD_SECONDS = 10 * 60;

const randomByte = () => Math.floor(Math.random() * 256) & 0xff;

const createRequestId = () => {
  const bytes = new Array(16).fill(0).map(randomByte);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const decodeBase64Url = (value) => {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(padded, 'base64').toString('utf8');
  }
  if (typeof atob === 'function') {
    return decodeURIComponent(escape(atob(padded)));
  }
  return '';
};

const decodeJwtPayload = (token) => {
  try {
    const [, payload] = String(token || '').split('.');
    if (!payload) {
      return null;
    }
    return JSON.parse(decodeBase64Url(payload));
  } catch {
    return null;
  }
};

const shouldRefreshToken = (token) => {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) {
    return false;
  }
  const remainingSeconds = Number(payload.exp) - Math.floor(Date.now() / 1000);
  return remainingSeconds > 0 && remainingSeconds < REFRESH_THRESHOLD_SECONDS;
};

const shouldLogoutForStatus = (statusCode) => Number(statusCode) === 401;

const buildRequestHeaders = ({
  token,
  mobileClientToken,
  requestId,
  contentType = 'application/json',
} = {}) => {
  const headers = {
    Accept: 'application/json',
    'X-Client-Platform': 'mobile',
  };

  if (contentType) {
    headers['Content-Type'] = contentType;
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (requestId) {
    headers['X-Request-ID'] = requestId;
  }
  if (mobileClientToken) {
    headers['X-Mobile-Client-Token'] = mobileClientToken;
  }

  return headers;
};

module.exports = {
  buildRequestHeaders,
  createRequestId,
  shouldLogoutForStatus,
  shouldRefreshToken,
};
