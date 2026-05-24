import apiClient from './client';
import * as normalizersModule from './normalizers.cjs';

const normalizers = normalizersModule.default || normalizersModule;
const { normalizeStatsPayload } = normalizers;
const unwrap = (response) => response?.data ?? response;

export const dashboardApi = {
  async getStats() {
    const response = await apiClient.get('/users/me/stats');
    const raw = unwrap(response);
    return {
      raw,
      summary: normalizeStatsPayload(raw),
    };
  },

  async getRecentActivities(params = {}) {
    const response = await apiClient.get('/users/me/activities', params);
    return Array.isArray(response?.data) ? response.data : [];
  },
};
