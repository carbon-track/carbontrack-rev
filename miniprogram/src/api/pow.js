import * as powCoreModule from '../utils/powCore.cjs';
import apiClient, { MOBILE_CLIENT_TYPE, requireMobileClientToken } from './client';

const powCore = powCoreModule.default || powCoreModule;
const { solveProofOfWork } = powCore;
const scopeQueues = new Map();

export const mobileClientType = MOBILE_CLIENT_TYPE;

export const getProofOfWorkChallenge = async (scope) => {
  requireMobileClientToken();
  const response = await apiClient.post('/security/pow/challenge', {
    scope,
    client_type: mobileClientType,
  }, { auth: false });
  return response?.data || response || {};
};

const appendProofFields = (payload, challenge, nonce) => ({
  ...(payload || {}),
  client_type: mobileClientType,
  pow_challenge: challenge,
  pow_nonce: String(nonce),
});

const buildProofPayload = async (scope, payload) => {
  const challenge = await getProofOfWorkChallenge(scope);
  const result = await solveProofOfWork(challenge.challenge, challenge.difficulty);
  return appendProofFields(payload, challenge.challenge, result.nonce);
};

export const withMobileProofOfWork = async (scope, payload = {}) => {
  const queue = scopeQueues.get(scope) || Promise.resolve();
  const next = queue.catch(() => {}).then(() => buildProofPayload(scope, payload));
  scopeQueues.set(scope, next);
  try {
    return await next;
  } finally {
    if (scopeQueues.get(scope) === next) {
      scopeQueues.delete(scope);
    }
  }
};
