const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildRequestHeaders,
  createRequestId,
  shouldLogoutForStatus,
  shouldRefreshToken,
} = require('./clientCore.cjs');

test('buildRequestHeaders adds auth, request id, and mobile PoW headers', () => {
  const headers = buildRequestHeaders({
    token: 'jwt-token',
    mobileClientToken: 'mobile-token',
    requestId: 'request-id',
  });

  assert.equal(headers.Accept, 'application/json');
  assert.equal(headers.Authorization, 'Bearer jwt-token');
  assert.equal(headers['X-Request-ID'], 'request-id');
  assert.equal(headers['X-Client-Platform'], 'mobile');
  assert.equal(headers['X-Mobile-Client-Token'], 'mobile-token');
});

test('createRequestId returns an RFC4122-like v4 id', () => {
  const id = createRequestId();

  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('shouldRefreshToken only refreshes tokens near expiry', () => {
  const encode = (payload) => Buffer.from(JSON.stringify(payload)).toString('base64url');
  const nowSeconds = Math.floor(Date.now() / 1000);
  const nearExpiry = `x.${encode({ exp: nowSeconds + 120 })}.y`;
  const later = `x.${encode({ exp: nowSeconds + 3600 })}.y`;

  assert.equal(shouldRefreshToken(nearExpiry), true);
  assert.equal(shouldRefreshToken(later), false);
  assert.equal(shouldRefreshToken('not-a-token'), false);
});

test('shouldRefreshToken decodes JWT payloads without Buffer or atob globals', () => {
  const encode = (payload) => Buffer.from(JSON.stringify(payload)).toString('base64url');
  const previousBuffer = global.Buffer;
  const previousAtob = global.atob;
  const previousTextDecoder = global.TextDecoder;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const nearExpiry = `x.${encode({ exp: nowSeconds + 120 })}.y`;

  try {
    global.Buffer = undefined;
    global.atob = undefined;
    global.TextDecoder = undefined;

    assert.equal(shouldRefreshToken(nearExpiry), true);
  } finally {
    global.Buffer = previousBuffer;
    global.atob = previousAtob;
    global.TextDecoder = previousTextDecoder;
  }
});

test('shouldLogoutForStatus only treats 401 as an auth logout signal', () => {
  assert.equal(shouldLogoutForStatus(401), true);
  assert.equal(shouldLogoutForStatus(403), false);
  assert.equal(shouldLogoutForStatus(500), false);
});
