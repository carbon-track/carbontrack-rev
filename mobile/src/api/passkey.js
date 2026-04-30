import apiClient from './client';

export const passkeyApi = {
  async getAuthenticationOptions(identifier) {
    const response = await apiClient.post('/auth/passkey/login/options', identifier ? { identifier } : {});
    return response.data;
  },

  async login(payload) {
    const response = await apiClient.post('/auth/passkey/login/verify', payload);
    return response.data;
  },
};
