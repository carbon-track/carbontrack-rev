const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const hasLeadingZeroBits = (digest, difficulty) => {
  const bytes = Buffer.from(digest, 'hex');
  const fullBytes = Math.floor(difficulty / 8);
  for (let index = 0; index < fullBytes; index += 1) {
    if (bytes[index] !== 0) {
      return false;
    }
  }

  const remainingBits = difficulty % 8;
  if (remainingBits === 0) {
    return true;
  }

  const mask = (0xff << (8 - remainingBits)) & 0xff;
  return (bytes[fullBytes] & mask) === 0;
};

const expectedNonce = (challenge, difficulty, maxAttempts) => {
  for (let nonce = 0; nonce < maxAttempts; nonce += 1) {
    const digest = crypto.createHash('sha256').update(`${challenge}:${nonce}`).digest('hex');
    if (hasLeadingZeroBits(digest, difficulty)) {
      return String(nonce);
    }
  }

  throw new Error('No matching nonce found by reference implementation');
};

const loadSolveProofOfWork = ({ includeTextEncoder }) => {
  const sourcePath = path.join(__dirname, 'pow.js');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const start = source.indexOf('const HASH_BATCH_SIZE');
  const end = source.indexOf('export const getProofOfWorkChallenge');
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const coreSource = source
    .slice(start, end)
    .replace('export const solveProofOfWork', 'const solveProofOfWork');
  const context = {
    AbortController,
    Array,
    Date,
    Error,
    Math,
    Number,
    Promise,
    RegExp,
    String,
    Uint8Array,
    Uint32Array,
    CarbonTrackPowNative: null,
    clearTimeout,
    module: { exports: {} },
    setTimeout,
  };
  context.globalThis = context;
  if (includeTextEncoder) {
    context.TextEncoder = TextEncoder;
  }

  vm.runInNewContext(`${coreSource}\nmodule.exports = { solveProofOfWork };`, context, {
    filename: 'pow-core-under-test.js',
  });

  return context.module.exports.solveProofOfWork;
};

const loadProofOfWorkModule = ({ apiClient, storeState, nativeModule = null }) => {
  const sourcePath = path.join(__dirname, 'pow.js');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const start = source.indexOf('const HASH_BATCH_SIZE');
  assert.notEqual(start, -1);

  const moduleSource = source
    .slice(start)
    .replace(/export const /g, 'const ');
  const context = {
    AbortController,
    Array,
    Date,
    Error,
    Math,
    Number,
    Promise,
    RegExp,
    String,
    TextEncoder,
    Uint8Array,
    Uint32Array,
    apiClient,
    clearTimeout,
    CarbonTrackPowNative: nativeModule,
    mobileClientType: 'mobile',
    module: { exports: {} },
    requireMobileClientToken: () => {},
    setTimeout,
    useProofOfWorkStore: {
      getState: () => storeState,
    },
  };
  context.globalThis = context;

  vm.runInNewContext(
    `${moduleSource}\nmodule.exports = { solveProofOfWork, withMobileProofOfWork };`,
    context,
    { filename: 'pow-module-under-test.js' },
  );

  return context.module.exports;
};

test('solveProofOfWork matches Node crypto for ASCII challenges', async () => {
  const solveProofOfWork = loadSolveProofOfWork({ includeTextEncoder: true });
  const challenge = 'carbontrack-pow-test';
  const difficulty = 10;
  const maxAttempts = 5000;

  const nonce = await solveProofOfWork(challenge, difficulty, { maxAttempts, timeoutMs: 5000 });

  assert.equal(nonce, expectedNonce(challenge, difficulty, maxAttempts));
});

test('solveProofOfWork fallback UTF-8 path matches Node crypto for unicode challenges', async () => {
  const solveProofOfWork = loadSolveProofOfWork({ includeTextEncoder: false });
  const challenge = '碳积分-🌱';
  const difficulty = 8;
  const maxAttempts = 5000;

  const nonce = await solveProofOfWork(challenge, difficulty, { maxAttempts, timeoutMs: 5000 });

  assert.equal(nonce, expectedNonce(challenge, difficulty, maxAttempts));
});

test('solveProofOfWork returns the fixed vector nonce through the JS fallback', async () => {
  const solveProofOfWork = loadSolveProofOfWork({ includeTextEncoder: true });
  const challenge = 'carbontrack-native-pow-vector';
  const difficulty = 12;

  const nonce = await solveProofOfWork(challenge, difficulty, {
    maxAttempts: 10000,
    timeoutMs: 5000,
  });

  assert.equal(nonce, '2547');
  const digest = crypto.createHash('sha256').update(`${challenge}:${nonce}`).digest('hex');
  assert.equal(digest, '000207000830575945a9e1031a7c9f770d69432f93508be3c1851c7ddbe74f8e');
  assert.equal(hasLeadingZeroBits(digest, difficulty), true);
});

test('solveProofOfWork prefers native solver when available', async () => {
  let calls = 0;
  const nativeModule = {
    solve: async (challenge, difficulty, maxAttempts, timeoutMs, operationId) => {
      calls += 1;
      assert.equal(challenge, 'native-challenge');
      assert.equal(difficulty, 20);
      assert.equal(maxAttempts, 3145728);
      assert.equal(timeoutMs, 30000);
      assert.match(operationId, /^pow-/);
      return { nonce: '42', attempts: 43, elapsedMs: 7 };
    },
    cancel: () => {},
  };
  const { solveProofOfWork } = loadProofOfWorkModule({
    apiClient: { post: async () => ({ data: { data: {} } }) },
    storeState: { begin: () => 'op', end: () => {} },
    nativeModule,
  });

  const nonce = await solveProofOfWork('native-challenge', 20);

  assert.equal(nonce, '42');
  assert.equal(calls, 1);
});

test('solveProofOfWork falls back to JS when native module is unavailable', async () => {
  const { solveProofOfWork } = loadProofOfWorkModule({
    apiClient: { post: async () => ({ data: { data: {} } }) },
    storeState: { begin: () => 'op', end: () => {} },
    nativeModule: null,
  });

  const nonce = await solveProofOfWork('carbontrack-pow-test', 10, {
    maxAttempts: 5000,
    timeoutMs: 5000,
  });

  assert.equal(nonce, expectedNonce('carbontrack-pow-test', 10, 5000));
});

test('solveProofOfWork does not fall back after native timeout', async () => {
  const nativeModule = {
    solve: async () => {
      throw new Error('Proof-of-work calculation timed out');
    },
    cancel: () => {},
  };
  const { solveProofOfWork } = loadProofOfWorkModule({
    apiClient: { post: async () => ({ data: { data: {} } }) },
    storeState: { begin: () => 'op', end: () => {} },
    nativeModule,
  });

  await assert.rejects(
    solveProofOfWork('native-timeout', 8, { maxAttempts: 5000, timeoutMs: 5000 }),
    /timed out/,
  );
});

test('solveProofOfWork stops when cancelled before solving', async () => {
  const solveProofOfWork = loadSolveProofOfWork({ includeTextEncoder: true });
  const abortController = new AbortController();
  abortController.abort();

  await assert.rejects(
    solveProofOfWork('carbontrack-pow-cancelled', 8, {
      maxAttempts: 5000,
      signal: abortController.signal,
      timeoutMs: 5000,
    }),
    /cancelled/,
  );
});

test('withMobileProofOfWork does not start queued work after cancellation', async () => {
  let activeCancel = null;
  const storeState = {
    begin: (scope, cancel) => {
      activeCancel = cancel;
      return `${scope}-operation`;
    },
    end: () => {},
  };
  let challengeRequests = 0;
  const apiClient = {
    post: (url, payload, options = {}) => {
      challengeRequests += 1;
      return new Promise((resolve, reject) => {
        options.signal?.addEventListener('abort', () => {
          reject(new Error('aborted'));
        });
        setTimeout(() => {
          resolve({
            data: {
              data: {
                challenge: `queued-${challengeRequests}`,
                difficulty: 8,
              },
            },
          });
        }, 20);
      });
    },
  };
  const { withMobileProofOfWork } = loadProofOfWorkModule({ apiClient, storeState });

  const first = withMobileProofOfWork('login', { first: true });
  const second = withMobileProofOfWork('login', { second: true });
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
  activeCancel();

  await assert.rejects(first, /aborted|cancelled/);
  await assert.rejects(second, /cancelled/);
  assert.equal(challengeRequests, 1);
});

test('withMobileProofOfWork cancels native work when the active operation is cancelled', async () => {
  let activeCancel = null;
  const cancelledOperationIds = [];
  const storeState = {
    begin: (scope, cancel) => {
      activeCancel = cancel;
      return `${scope}-operation`;
    },
    end: () => {},
  };
  const apiClient = {
    post: async () => ({
      data: {
        data: {
          challenge: 'native-cancel',
          difficulty: 20,
        },
      },
    }),
  };
  const nativeModule = {
    solve: async (challenge, difficulty, maxAttempts, timeoutMs, operationId) => new Promise((resolve, reject) => {
      setTimeout(() => {
        if (cancelledOperationIds.includes(operationId)) {
          reject(new Error('Proof-of-work calculation cancelled'));
          return;
        }
        resolve({ nonce: '1', attempts: 2, elapsedMs: 10 });
      }, 20);
    }),
    cancel: (operationId) => {
      cancelledOperationIds.push(operationId);
    },
  };
  const { withMobileProofOfWork } = loadProofOfWorkModule({ apiClient, storeState, nativeModule });

  const request = withMobileProofOfWork('auth.login', { login: true });
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
  activeCancel();

  await assert.rejects(request, /cancelled/);
  assert.equal(cancelledOperationIds.length, 1);
  assert.match(cancelledOperationIds[0], /^pow-/);
});
