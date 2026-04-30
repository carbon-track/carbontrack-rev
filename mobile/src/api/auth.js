import apiClient from './client';
import { withMobileProofOfWork } from './pow';

export const authApi = {
  async login(payload) {
    const response = await apiClient.post('/auth/login', await withMobileProofOfWork('auth.login', payload));
    return response.data;
  },

  async register(payload) {
    const response = await apiClient.post('/auth/register', await withMobileProofOfWork('auth.register', payload));
    return response.data;
  },

  async sendVerificationCode(payload) {
    const response = await apiClient.post(
      '/auth/send-verification-code',
      await withMobileProofOfWork('auth.send_verification_code', payload),
    );
    return response.data;
  },

  async verifyEmail(payload) {
    const response = await apiClient.post('/auth/verify-email', await withMobileProofOfWork('auth.verify_email', payload));
    return response.data;
  },

  async logout() {
    const response = await apiClient.post('/auth/logout');
    return response.data;
  },
};
