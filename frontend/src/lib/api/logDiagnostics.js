import api from '../api';

const path = '/admin/log-diagnostics';
const read = async (suffix, params) => (await api.get(path + suffix, { params })).data;
const write = async (suffix, data) => (await api.post(path + suffix, data)).data;

export const logDiagnostics = {
  settings: () => read('/settings'),
  sessions: (params) => read('/sessions', params),
  detail: (id) => read('/sessions/' + id),
  history: (id, beforeId) => read('/sessions/' + id + '/access-audits', { before_id: beforeId }),
  create: (data) => write('/sessions', data),
  issue: (id) => write('/sessions/' + id + '/credentials'),
  revoke: (id, credentialId) => write('/sessions/' + id + (credentialId ? '/credentials/' + credentialId : '') + '/revoke'),
  consent: (id) => read('/oauth-requests/' + encodeURIComponent(id)),
  decide: (id, data) => write('/oauth-requests/' + encodeURIComponent(id) + '/decision', data),
};
