import apiClient from './client';
import * as Crypto from 'expo-crypto';
import { mobileClientType, requireMobileClientToken } from './mobileClientConfig';

const HASH_BATCH_SIZE = 16;
const YIELD_INTERVAL = 512;
const MAX_SOLVE_ATTEMPTS = 2000000;
const MAX_SOLVE_MS = 30000;
const MAX_DYNAMIC_SOLVE_ATTEMPTS = 12000000;
const MAX_DYNAMIC_SOLVE_MS = 90000;
const EXPECTED_ATTEMPT_MULTIPLIER = 3;

const pause = () => new Promise((resolve) => {
  setTimeout(resolve, 0);
});

const hasLeadingZeroBits = (hex, difficulty) => {
  const fullNibbles = Math.floor(difficulty / 4);
  for (let i = 0; i < fullNibbles; i += 1) {
    if (hex[i] !== '0') {
      return false;
    }
  }

  const remainingBits = difficulty % 4;
  if (remainingBits === 0) {
    return true;
  }

  const nibble = Number.parseInt(hex[fullNibbles], 16);
  const mask = (0xf << (4 - remainingBits)) & 0xf;
  return (nibble & mask) === 0;
};

const sha256Hex = (message) => Crypto.digestStringAsync(
  Crypto.CryptoDigestAlgorithm.SHA256,
  message,
);

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
  let nonce = 0;
  let checked = 0;
  while (checked < maxAttempts) {
    if (options.signal?.aborted) {
      throw new Error('Proof-of-work calculation cancelled');
    }
    if (Date.now() - startedAt > maxSolveMs) {
      throw new Error('Proof-of-work calculation timed out');
    }

    const batch = Array.from({ length: HASH_BATCH_SIZE }, (_, index) => nonce + index);
    const hashes = await Promise.all(batch.map((candidate) => sha256Hex(`${challenge}:${candidate}`)));

    for (let index = 0; index < hashes.length; index += 1) {
      if (hasLeadingZeroBits(hashes[index], normalizedDifficulty)) {
        return String(batch[index]);
      }
    }

    nonce += HASH_BATCH_SIZE;
    checked += HASH_BATCH_SIZE;
    if (checked % YIELD_INTERVAL === 0) {
      await pause();
    }
  }

  throw new Error('Proof-of-work attempt limit exceeded');
};

export const getProofOfWorkChallenge = async (scope) => {
  requireMobileClientToken();

  const response = await apiClient.post('/security/pow/challenge', {
    scope,
    client_type: mobileClientType,
  });
  return response.data?.data || {};
};

export const withMobileProofOfWork = async (scope, payload) => {
  const challenge = await getProofOfWorkChallenge(scope);
  const nonce = await solveProofOfWork(challenge.challenge, challenge.difficulty);

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
};
