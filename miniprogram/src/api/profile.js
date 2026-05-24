import apiClient from './client';

const unwrap = (response) => response?.data ?? response;

export const profileApi = {
  async getMe() {
    return unwrap(await apiClient.get('/users/me'));
  },

  async getPointsHistory(params = {}) {
    const response = unwrap(await apiClient.get('/users/me/points-history', params));
    return {
      transactions: response?.transactions || [],
      pagination: response?.pagination || { page: 1, pages: 1, total: 0 },
    };
  },

  async getBadges() {
    const response = unwrap(await apiClient.get('/users/me/badges'));
    return Array.isArray(response) ? response : response?.badges || [];
  },
};
