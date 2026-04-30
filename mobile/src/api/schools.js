import apiClient from './client';

export const schoolApi = {
  async list(params = {}) {
    const response = await apiClient.get('/schools', {
      params: { limit: 100, page: 1, ...params },
    });
    return response.data;
  },
};
