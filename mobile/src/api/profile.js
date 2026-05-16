import apiClient from './client';
import { withMobileProofOfWork } from './pow';
import {
  normalizeNotificationPreferences,
  normalizePasskeysPayload,
  normalizeSecurityActivityPayload,
  serializeNotificationPreferences,
} from '../lib/userContent';

const unwrap = (response) => response.data?.data ?? response.data;

export const profileApi = {
  getCurrentUser: async () => unwrap(await apiClient.get('/users/me')),
  updateProfile: async (payload) => {
    const needsSchoolProof = Boolean(payload?.school_id || payload?.new_school_name);
    const requestPayload = needsSchoolProof
      ? await withMobileProofOfWork('user.profile.school_change', payload)
      : payload;
    return unwrap(await apiClient.put('/users/me/profile', requestPayload));
  },
  changePassword: async (payload) => unwrap(await apiClient.post('/auth/change-password', payload)),
  getNotificationPreferences: async () => normalizeNotificationPreferences(unwrap(await apiClient.get('/users/me/notification-preferences'))),
  updateNotificationPreferences: async (preferences) => normalizeNotificationPreferences(
    unwrap(await apiClient.put('/users/me/notification-preferences', {
      preferences: serializeNotificationPreferences(preferences),
    })),
  ),
  sendNotificationTestEmail: async (category) => unwrap(await apiClient.post('/users/me/notification-preferences/test-email', { category })),
  getSecurityActivity: async (params = {}) => normalizeSecurityActivityPayload(unwrap(await apiClient.get('/users/me/security-activity', { params }))),
  listPasskeys: async () => normalizePasskeysPayload(unwrap(await apiClient.get('/users/me/passkeys'))),
  getPasskeyRegistrationOptions: async () => unwrap(await apiClient.post('/users/me/passkeys/registration/options')),
  registerPasskey: async (payload) => unwrap(await apiClient.post('/users/me/passkeys/registration/verify', payload)),
  updatePasskey: async (id, payload) => unwrap(await apiClient.patch(`/users/me/passkeys/${id}`, payload)),
  deletePasskey: async (id) => unwrap(await apiClient.delete(`/users/me/passkeys/${id}`)),
};
