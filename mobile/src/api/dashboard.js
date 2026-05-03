import apiClient from './client';

const unwrap = (response) => response.data?.data ?? response.data;

export const dashboardApi = {
  getStats: async () => unwrap(await apiClient.get('/users/me/stats')),
  getChartData: async (params = {}) => unwrap(await apiClient.get('/users/me/chart-data', { params })),
  getRecentActivities: async (params = {}) => unwrap(await apiClient.get('/users/me/activities', { params })),
};
