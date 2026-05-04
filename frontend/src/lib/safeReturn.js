// Open-redirect-safe helper for `return` query parameters used by auth flows.
// Only same-origin absolute paths are accepted; any value that could be parsed
// by the browser as cross-origin (protocol-absolute, scheme-prefixed, or with
// embedded `://`) falls back to the supplied default route.

const MAX_RETURN_LENGTH = 1024;

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;
const stripControlCharacters = (value) => value.replaceAll(CONTROL_CHARS, '');

export const safeReturnPath = (raw, fallback = '/dashboard') => {
  if (typeof raw !== 'string') {
    return fallback;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return fallback;
  }

  if (trimmed.length > MAX_RETURN_LENGTH) {
    return fallback;
  }

  const sanitized = stripControlCharacters(trimmed);
  if (!sanitized) {
    return fallback;
  }

  // Must begin with a single forward slash. `//` and `/\` are protocol-relative
  // or path-traversal escapes that browsers can resolve to other origins.
  if (!sanitized.startsWith('/')) {
    return fallback;
  }
  if (sanitized.startsWith('//') || sanitized.startsWith('/\\')) {
    return fallback;
  }

  // Reject anything that looks like an absolute URL embedded in the path.
  if (sanitized.includes('://')) {
    return fallback;
  }

  // Disallow backslash anywhere because IE/legacy parsers treat them as `/`.
  if (sanitized.includes('\\')) {
    return fallback;
  }

  return sanitized;
};

export default safeReturnPath;
