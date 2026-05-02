import apiClient from './client';

const unwrap = (response) => response.data?.data ?? response.data;

const normalizeProductsPayload = (payload) => {
  if (Array.isArray(payload)) {
    return { products: payload, pagination: { page: 1, pages: 1, total: payload.length } };
  }
  return {
    products: Array.isArray(payload?.products) ? payload.products : [],
    pagination: payload?.pagination || { page: 1, pages: 1, total: 0 },
  };
};

const normalizeCategoriesPayload = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }
  return Array.isArray(payload?.categories) ? payload.categories : [];
};

export const rewardsApi = {
  getProducts: async (params = {}) => normalizeProductsPayload(unwrap(await apiClient.get('/products', { params }))),
  getCategories: async (params = {}) => normalizeCategoriesPayload(unwrap(await apiClient.get('/products/categories', { params }))),
  exchangeProduct: async (payload) => unwrap(await apiClient.post('/exchange', payload)),
  getExchangeTransactions: async (params = {}) => {
    const response = await apiClient.get('/exchange/transactions', { params });
    return {
      exchanges: Array.isArray(response.data?.data) ? response.data.data : [],
      pagination: response.data?.pagination || { page: 1, pages: 1, total: 0 },
    };
  },
  getBadges: async () => unwrap(await apiClient.get('/badges')),
  getMyBadges: async () => unwrap(await apiClient.get('/users/me/badges')),
  getCheckins: async (params = {}) => unwrap(await apiClient.get('/users/me/checkins', { params })),
};
