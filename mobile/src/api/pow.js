import apiClient from './client';
import { mobileClientType, requireMobileClientToken } from './mobileClientConfig';
import useProofOfWorkStore from '../store/proofOfWorkStore';

const HASH_BATCH_SIZE = 512;
const YIELD_INTERVAL = HASH_BATCH_SIZE * 2;
const MAX_SOLVE_ATTEMPTS = 2000000;
const MAX_SOLVE_MS = 30000;
const MAX_DYNAMIC_SOLVE_ATTEMPTS = 12000000;
const MAX_DYNAMIC_SOLVE_MS = 90000;
const EXPECTED_ATTEMPT_MULTIPLIER = 3;
const POW_UI_WATCHDOG_MS = MAX_DYNAMIC_SOLVE_MS + 10000;
const scopeQueues = new Map();
let cachedTextEncoder = null;
// PoW needs hundreds of thousands of hashes; keep hashing inside JS instead of
// crossing the Expo native module boundary once per nonce.
const SHA256_INITIAL_STATE = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];
const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

const pause = () => new Promise((resolve) => {
  setTimeout(resolve, 0);
});

const rotateRight = (value, bits) => (
  (value >>> bits) | (value << (32 - bits))
);

const blockLengthForMessage = (messageLength) => (
  Math.ceil((messageLength + 1 + 8) / 64) * 64
);

const utf8Bytes = (message) => {
  if (typeof globalThis.TextEncoder === 'function') {
    if (!cachedTextEncoder) {
      cachedTextEncoder = new globalThis.TextEncoder();
    }
    return cachedTextEncoder.encode(message);
  }

  const bytes = [];

  for (let i = 0; i < message.length; i += 1) {
    let codePoint = message.charCodeAt(i);

    if (codePoint >= 0xd800 && codePoint <= 0xdbff && i + 1 < message.length) {
      const next = message.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        codePoint = 0x10000 + ((codePoint - 0xd800) << 10) + (next - 0xdc00);
        i += 1;
      }
    }

    if (codePoint < 0x80) {
      bytes.push(codePoint);
    } else if (codePoint < 0x800) {
      bytes.push(
        0xc0 | (codePoint >> 6),
        0x80 | (codePoint & 0x3f),
      );
    } else if (codePoint < 0x10000) {
      bytes.push(
        0xe0 | (codePoint >> 12),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    } else {
      bytes.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    }
  }

  return bytes;
};

const writeDecimalBytes = (value, buffer, offset) => {
  const text = String(value);
  for (let i = 0; i < text.length; i += 1) {
    buffer[offset + i] = text.charCodeAt(i);
  }
  return offset + text.length;
};

const createSha256Workspace = (maxMessageLength) => ({
  buffer: new Uint8Array(blockLengthForMessage(maxMessageLength)),
  words: new Uint32Array(64),
  state: new Uint32Array(8),
  digest: new Uint8Array(32),
});

const sha256WorkspaceDigest = (workspace, messageLength) => {
  const { buffer, words, state, digest } = workspace;
  const bitLength = messageLength * 8;
  const totalLength = blockLengthForMessage(messageLength);

  buffer.fill(0, messageLength, totalLength);
  buffer[messageLength] = 0x80;
  state.set(SHA256_INITIAL_STATE);

  const highBits = Math.floor(bitLength / 0x100000000);
  const lowBits = bitLength >>> 0;
  buffer[totalLength - 8] = (highBits >>> 24) & 0xff;
  buffer[totalLength - 7] = (highBits >>> 16) & 0xff;
  buffer[totalLength - 6] = (highBits >>> 8) & 0xff;
  buffer[totalLength - 5] = highBits & 0xff;
  buffer[totalLength - 4] = (lowBits >>> 24) & 0xff;
  buffer[totalLength - 3] = (lowBits >>> 16) & 0xff;
  buffer[totalLength - 2] = (lowBits >>> 8) & 0xff;
  buffer[totalLength - 1] = lowBits & 0xff;

  for (let offset = 0; offset < totalLength; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      const j = offset + i * 4;
      words[i] = (
        (buffer[j] << 24)
        | (buffer[j + 1] << 16)
        | (buffer[j + 2] << 8)
        | buffer[j + 3]
      ) >>> 0;
    }

    for (let i = 16; i < 64; i += 1) {
      const s0 = rotateRight(words[i - 15], 7) ^ rotateRight(words[i - 15], 18) ^ (words[i - 15] >>> 3);
      const s1 = rotateRight(words[i - 2], 17) ^ rotateRight(words[i - 2], 19) ^ (words[i - 2] >>> 10);
      words[i] = (words[i - 16] + s0 + words[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = state;

    for (let i = 0; i < 64; i += 1) {
      const sigma1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + sigma1 + ch + SHA256_K[i] + words[i]) >>> 0;
      const sigma0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sigma0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    state[0] = (state[0] + a) >>> 0;
    state[1] = (state[1] + b) >>> 0;
    state[2] = (state[2] + c) >>> 0;
    state[3] = (state[3] + d) >>> 0;
    state[4] = (state[4] + e) >>> 0;
    state[5] = (state[5] + f) >>> 0;
    state[6] = (state[6] + g) >>> 0;
    state[7] = (state[7] + h) >>> 0;
  }

  for (let i = 0; i < state.length; i += 1) {
    digest[i * 4] = (state[i] >>> 24) & 0xff;
    digest[i * 4 + 1] = (state[i] >>> 16) & 0xff;
    digest[i * 4 + 2] = (state[i] >>> 8) & 0xff;
    digest[i * 4 + 3] = state[i] & 0xff;
  }

  return digest;
};

const createProofOfWorkHasher = (challenge, maxAttempts) => {
  const prefixBytes = utf8Bytes(`${challenge}:`);
  const maxNonceDigits = Math.max(1, String(Math.max(0, maxAttempts - 1)).length);
  const workspace = createSha256Workspace(prefixBytes.length + maxNonceDigits);

  return (nonce) => {
    workspace.buffer.set(prefixBytes, 0);
    const messageLength = writeDecimalBytes(nonce, workspace.buffer, prefixBytes.length);
    return sha256WorkspaceDigest(workspace, messageLength);
  };
};

const hasLeadingZeroBits = (bytes, difficulty) => {
  const fullBytes = Math.floor(difficulty / 8);
  for (let i = 0; i < fullBytes; i += 1) {
    if (bytes[i] !== 0) {
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

export const solveProofOfWork = async (challenge, difficulty, options = {}) => {
  const normalizedDifficulty = Number(difficulty);
  if (!challenge || !Number.isFinite(normalizedDifficulty) || normalizedDifficulty < 1) {
    throw new Error('Invalid proof-of-work challenge');
  }

  const expectedAttempts = 2 ** Math.min(28, Math.floor(normalizedDifficulty));
  const maxAttempts = Number.isFinite(options.maxAttempts)
    ? Math.max(1, Math.floor(options.maxAttempts))
    : Math.min(
      MAX_DYNAMIC_SOLVE_ATTEMPTS,
      Math.max(MAX_SOLVE_ATTEMPTS, expectedAttempts * EXPECTED_ATTEMPT_MULTIPLIER),
    );
  const maxSolveMs = Number.isFinite(options.timeoutMs)
    ? Math.max(1000, Math.floor(options.timeoutMs))
    : Math.min(
      MAX_DYNAMIC_SOLVE_MS,
      normalizedDifficulty >= 22 ? MAX_DYNAMIC_SOLVE_MS : MAX_SOLVE_MS,
    );
  const startedAt = Date.now();
  const hashNonce = createProofOfWorkHasher(challenge, maxAttempts);
  let nonce = 0;
  let checked = 0;
  while (checked < maxAttempts) {
    if (options.signal?.aborted) {
      throw new Error('Proof-of-work calculation cancelled');
    }
    if (Date.now() - startedAt > maxSolveMs) {
      throw new Error('Proof-of-work calculation timed out');
    }

    const batchEnd = Math.min(nonce + HASH_BATCH_SIZE, maxAttempts);
    for (; nonce < batchEnd; nonce += 1) {
      if (hasLeadingZeroBits(hashNonce(nonce), normalizedDifficulty)) {
        return String(nonce);
      }
    }

    checked = nonce;
    if (checked % YIELD_INTERVAL === 0) {
      await pause();
    }
  }

  throw new Error('Proof-of-work attempt limit exceeded');
};

export const getProofOfWorkChallenge = async (scope, options = {}) => {
  requireMobileClientToken();

  const response = await apiClient.post('/security/pow/challenge', {
    scope,
    client_type: mobileClientType,
  }, {
    signal: options.signal,
  });
  return response.data?.data || {};
};

const cancellationError = () => new Error('Proof-of-work calculation cancelled');

const buildProofOfWorkPayload = async (scope, payload, queue) => {
  if (queue?.cancelled) {
    throw cancellationError();
  }

  const abortController = typeof AbortController === 'function' ? new AbortController() : null;
  const operationId = useProofOfWorkStore.getState().begin(scope, () => {
    if (queue) {
      queue.cancelled = true;
    }
    abortController?.abort();
  });
  const watchdog = setTimeout(() => {
    useProofOfWorkStore.getState().end(operationId);
  }, POW_UI_WATCHDOG_MS);

  try {
    const challenge = await getProofOfWorkChallenge(scope, { signal: abortController?.signal });
    if (queue?.cancelled) {
      throw cancellationError();
    }
    const nonce = await solveProofOfWork(challenge.challenge, challenge.difficulty, {
      signal: abortController?.signal,
    });

    if (payload && typeof payload.append === 'function') {
      payload.append('client_type', mobileClientType);
      payload.append('pow_challenge', challenge.challenge);
      payload.append('pow_nonce', nonce);
      return payload;
    }

    return {
      ...payload,
      client_type: mobileClientType,
      pow_challenge: challenge.challenge,
      pow_nonce: nonce,
    };
  } finally {
    clearTimeout(watchdog);
    useProofOfWorkStore.getState().end(operationId);
  }
};

export const withMobileProofOfWork = async (scope, payload) => {
  const queue = scopeQueues.get(scope) || {
    cancelled: false,
    pending: 0,
    promise: Promise.resolve(),
  };
  scopeQueues.set(scope, queue);
  queue.pending += 1;

  const previous = queue.promise;
  const queued = previous
    .catch(() => {})
    .then(() => {
      if (queue.cancelled) {
        throw cancellationError();
      }
      return buildProofOfWorkPayload(scope, payload, queue);
    });
  const tracked = queued.finally(() => {
    queue.pending = Math.max(0, queue.pending - 1);
    if (queue.pending === 0 && scopeQueues.get(scope) === queue) {
      scopeQueues.delete(scope);
    }
  });

  queue.promise = tracked;
  return tracked;
};
