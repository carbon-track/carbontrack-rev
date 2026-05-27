const REFRESH_THRESHOLD_SECONDS = 10 * 60;

const randomByte = () => Math.floor(Math.random() * 256) & 0xff;

const createRequestId = () => {
  const bytes = new Array(16).fill(0).map(randomByte);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const decodeBase64ToBytes = (value) => {
  const bytes = [];
  let buffer = 0;
  let bits = 0;
  String(value || '').replace(/=+$/g, '').split('').forEach((char) => {
    const index = BASE64_ALPHABET.indexOf(char);
    if (index < 0) {
      return;
    }

    buffer = (buffer << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  });
  return bytes;
};

const decodeUtf8Bytes = (bytes) => {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
  }

  const encoded = bytes.map((byte) => `%${byte.toString(16).padStart(2, '0')}`).join('');
  return decodeURIComponent(encoded);
};

const decodeBase64Url = (value) => {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  return decodeUtf8Bytes(decodeBase64ToBytes(normalized));
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
