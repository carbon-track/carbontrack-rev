import apiClient from './client';
import * as Crypto from 'expo-crypto';

const MOBILE_CLIENT_TYPE = 'mobile';
const YIELD_INTERVAL = 2048;

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

  const nibble = parseInt(hex[fullNibbles], 16);
  const mask = 0xf << (4 - remainingBits);
  return (nibble & mask) === 0;
};

const sha256Hex = (message) => Crypto.digestStringAsync(
  Crypto.CryptoDigestAlgorithm.SHA256,
  message,
);

export const solveProofOfWork = async (challenge, difficulty) => {
  const targetDifficulty = Number(difficulty);
  if (!challenge || !Number.isFinite(targetDifficulty) || targetDifficulty < 1) {
    throw new Error('Invalid proof-of-work challenge');
  }

  let nonce = Math.floor(Math.random() * 1000000);
  for (;;) {
    const hash = await sha256Hex(`${challenge}:${nonce}`);
    if (hasLeadingZeroBits(hash, targetDifficulty)) {
      return String(nonce);
    }

    nonce += 1;
    if (nonce % YIELD_INTERVAL === 0) {
      await pause();
    }
  }
};

export const getProofOfWorkChallenge = async (scope) => {
  const response = await apiClient.post('/security/pow/challenge', {
    scope,
    client_type: MOBILE_CLIENT_TYPE,
  });
  return response.data?.data || {};
};

export const withMobileProofOfWork = async (scope, payload) => {
  const challenge = await getProofOfWorkChallenge(scope);
  const nonce = await solveProofOfWork(challenge.challenge, challenge.difficulty);

  if (payload && typeof payload.append === 'function') {
    payload.append('client_type', MOBILE_CLIENT_TYPE);
    payload.append('pow_challenge', challenge.challenge);
    payload.append('pow_nonce', nonce);
    return payload;
  }

  return {
    ...payload,
    client_type: MOBILE_CLIENT_TYPE,
    pow_challenge: challenge.challenge,
    pow_nonce: nonce,
  };
};
