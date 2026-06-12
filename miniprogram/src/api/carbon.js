import apiClient from './client';
import { withMobileProofOfWork } from './pow';
import * as normalizersModule from './normalizers.cjs';

const normalizers = normalizersModule.default || normalizersModule;
const { normalizeRecordsPayload } = normalizers;
const unwrap = (response) => response?.data ?? response;

const normalizeActivitiesPayload = (payload) => {
  if (Array.isArray(payload)) {
    return { activities: payload, categories: [] };
  }
  return {
    activities: Array.isArray(payload?.activities) ? payload.activities : [],
    categories: Array.isArray(payload?.categories) ? payload.categories : [],
  };
};

export const carbonApi = {
  async getActivityFactors() {
    const [factorResponse, activityResponse] = await Promise.all([
      apiClient.get('/carbon-track/factors'),
      apiClient.get('/carbon-activities'),
    ]);
    return {
      ...normalizeActivitiesPayload(unwrap(activityResponse)),
      factors: unwrap(factorResponse),
    };
  },

  async calculate({ activityId, amount, unit }) {
    const response = await apiClient.post('/carbon-track/calculate', {
      activity_id: activityId,
      amount: Number(amount),
      unit,
    });
    return unwrap(response);
  },

  async submitRecord(payload) {
    const formData = await withMobileProofOfWork('carbon.record.submit', {
      activity_id: String(payload.activityId),
      amount: String(payload.amount),
      date: payload.date,
      unit: payload.unit || '',
      description: payload.description || '',
    });

    return apiClient.uploadFile('/carbon-records', {
      filePath: payload.imagePath,
      name: 'image',
      formData,
    });
  },

  async getRecords(params = {}) {
    const response = await apiClient.get('/carbon-track/transactions', params);
    return normalizeRecordsPayload(response);
  },

  async getRecord(id) {
    const response = await apiClient.get(`/carbon-track/transactions/${id}`);
    return unwrap(response);
  },
};
