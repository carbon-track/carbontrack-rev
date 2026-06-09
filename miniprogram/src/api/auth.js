import apiClient from './client';
import { withMobileProofOfWork } from './pow';
import { getRefreshToken } from '../store/session';

export const authApi = {
  async login(payload) {
    return apiClient.post('/auth/login', await withMobileProofOfWork('auth.login', payload), { auth: false });
  },

  async register(payload) {
    return apiClient.post('/auth/register', await withMobileProofOfWork('auth.register', payload), { auth: false });
  },

  async sendVerificationCode(payload) {
    return apiClient.post(
      '/auth/send-verification-code',
      await withMobileProofOfWork('auth.send_verification_code', payload),
      { auth: false },
    );
  },

  async verifyEmail(payload) {
    return apiClient.post('/auth/verify-email', await withMobileProofOfWork('auth.verify_email', payload), { auth: false });
  },

  async logout() {
    const refreshToken = getRefreshToken();
    return apiClient.post('/auth/logout', refreshToken ? { refresh_token: refreshToken } : {}, { skipAuthRefresh: true });
  },
};
