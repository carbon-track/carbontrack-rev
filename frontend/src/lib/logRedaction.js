const MASKED_VALUE = '[REDACTED]';

const SENSITIVE_KEY_PATTERNS = [
  /(^|[_-])(password|passwd|passphrase|pwd|pass|pw)([_-]|$)/i,
  /(^|[_-])(token|secret|credential|credentials)([_-]|$)/i,
  /authorization/i,
  /cookie/i,
  /(^|[_-])(csrf|xsrf|turnstile)([_-]|$)/i,
  /(^|[_-])auth([_-]|$)/i,
  /(^|[_-])(session|sess)([_-]|$)/i,
  /(^|[_-])jwt([_-].*(secret|token)|$)/i,
  /(^|[_-])(api|access|private|secret|signing|encryption|webhook|client|r2|s3|aws|cloudflare)[_-]?key([_-]|$)/i
];

export function safeParseLogValue(value) {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function isSensitiveLogKey(key) {
  const normalized = String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function maskSensitiveJson(value) {
  if (Array.isArray(value)) {
    return value.map((item) => maskSensitiveJson(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        isSensitiveLogKey(key) ? MASKED_VALUE : maskSensitiveJson(child)
      ])
    );
  }
  return value;
}

export function maskServerMeta(value) {
  const parsed = safeParseLogValue(value);
  if (typeof parsed === 'string' && parsed.trim() !== '') {
    return MASKED_VALUE;
  }
  if (!parsed || typeof parsed !== 'object') {
    return parsed;
  }

  return maskSensitiveJson(parsed);
}

export function redactLogEntry(entry) {
  return redactLogValue(entry);
}

function redactLogValue(value, key = '') {
  if (isSensitiveLogKey(key)) {
    return MASKED_VALUE;
  }

  if (key === 'server_meta') {
    return maskServerMeta(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactLogValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, child]) => [
        childKey,
        redactLogValue(child, childKey)
      ])
    );
  }

  if (typeof value === 'string') {
    const parsed = safeParseLogValue(value);
    if (parsed && typeof parsed === 'object') {
      return redactLogValue(parsed, key);
    }
  }

  return value;
}
