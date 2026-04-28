import apiClient from './client';

export const authApi = {
  async login(payload) {
    const response = await apiClient.post('/auth/login', payload);
    return response.data;
  },

  async register(payload) {
    const response = await apiClient.post('/auth/register', payload);
    return response.data;
  },

  async sendVerificationCode(payload) {
    const response = await apiClient.post('/auth/send-verification-code', payload);
    return response.data;
  },

  async verifyEmail(payload) {
    const response = await apiClient.post('/auth/verify-email', payload);
    return response.data;
  },

  async logout() {
    const response = await apiClient.post('/auth/logout');
    return response.data;
  },
};
