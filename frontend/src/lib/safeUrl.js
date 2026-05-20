export const SAFE_HTML_URI_PATTERN = /^(?:(?:https?|mailto|tel):|#|\/(?![/\\]))/i;

const STORAGE_HOST_SUFFIXES = ['.r2.dev', '.r2.cloudflarestorage.com'];
const ATTACHMENT_ORIGIN_ENV_KEYS = [
  'VITE_ASSETS_URL',
  'VITE_UPLOAD_URL',
  'VITE_R2_PUBLIC_URL',
];

export function isSafeHtmlUri(value) {
  if (typeof value !== 'string') {
    return false;
  }

  const trimmed = value.trim();
  return trimmed !== '' && !trimmed.includes('\\') && SAFE_HTML_URI_PATTERN.test(trimmed);
}

function envValue(key) {
  return import.meta.env?.[key];
}

function configuredAttachmentOrigins() {
  const origins = new Set();

  ATTACHMENT_ORIGIN_ENV_KEYS.forEach((key) => {
    const raw = envValue(key);
    if (typeof raw !== 'string' || !raw.trim()) {
      return;
    }
    try {
      origins.add(new URL(raw.trim()).origin);
    } catch {
      // Ignore malformed optional env values.
    }
  });

  if (typeof window !== 'undefined' && window.location?.origin) {
    origins.add(window.location.origin);
  }

  return origins;
}

function isSafeAttachmentAbsoluteUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return false;
  }

  if (configuredAttachmentOrigins().has(url.origin)) {
    return true;
  }

  const hostname = url.hostname.toLowerCase();
  return STORAGE_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
}

export function safeAttachmentHref(value) {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return '';
  }

  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  return isSafeAttachmentAbsoluteUrl(trimmed) ? trimmed : '';
}

function containsUnsafeFilePathChars(value) {
  if (value.includes('\\') || value.includes('?') || value.includes('#')) {
    return true;
  }

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) {
      return true;
    }
  }

  return false;
}

export function normalizeSafeAttachmentFilePath(value) {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  if (
    !trimmed
    || trimmed.startsWith('//')
    || /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
    || containsUnsafeFilePathChars(trimmed)
  ) {
    return '';
  }

  const normalized = trimmed.replace(/^\/+/, '');
  if (!normalized || normalized.split('/').some((segment) => segment === '..')) {
    return '';
  }

  return normalized;
}

export function attachmentDisplayHref(attachment) {
  return safeAttachmentHref(attachment?.download_url)
    || safeAttachmentHref(attachment?.public_url)
    || safeAttachmentHref(attachment?.file_path);
}
