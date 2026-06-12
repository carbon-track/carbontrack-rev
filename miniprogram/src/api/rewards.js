import apiClient from './client';
import * as normalizersModule from './normalizers.cjs';

const normalizers = normalizersModule.default || normalizersModule;
const {
  normalizeExchangesPayload,
  normalizeProductsPayload,
} = normalizers;
const unwrap = (response) => response?.data ?? response;

export const rewardsApi = {
  async getProducts(params = {}) {
    return normalizeProductsPayload(await apiClient.get('/products', params));
  },

  async getCategories(params = {}) {
    const response = unwrap(await apiClient.get('/products/categories', params));
    return Array.isArray(response) ? response : response?.categories || [];
  },

  async exchangeProduct(payload) {
    return apiClient.post('/exchange', payload);
  },

  async getExchangeTransactions(params = {}) {
    return normalizeExchangesPayload(await apiClient.get('/exchange/transactions', params));
  },
};
