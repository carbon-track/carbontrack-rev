import apiClient from './client';

const unwrap = (response) => response.data?.data ?? response.data;

const normalizeActivitiesPayload = (payload) => {
  if (Array.isArray(payload)) {
    return { activities: payload, categories: [], meta: {} };
  }
  return {
    activities: payload?.activities || [],
    categories: payload?.categories || [],
    meta: payload || {},
  };
};

const getUploadFileName = (image) => image.fileName
  || image.uri?.split('/').pop()
  || `carbon-record-${Date.now()}.jpg`;

export const carbonApi = {
  getActivityFactors: async () => {
    const [factorResponse, activityResponse] = await Promise.all([
      apiClient.get('/carbon-track/factors'),
      apiClient.get('/carbon-activities'),
    ]);
    const activityPayload = normalizeActivitiesPayload(unwrap(activityResponse));
    return {
      ...activityPayload,
      factors: unwrap(factorResponse),
    };
  },

  calculate: async ({ activityId, amount, unit }) => unwrap(await apiClient.post('/carbon-track/calculate', {
    activity_id: activityId,
    amount: Number(amount),
    unit,
  })),

  submitRecord: async ({ activityId, amount, date, description, image, unit }) => {
    const formData = new FormData();
    formData.append('activity_id', String(activityId));
    formData.append('amount', String(amount));
    formData.append('date', date);
    if (unit) {
      formData.append('unit', unit);
    }
    if (description) {
      formData.append('description', description);
    }
    formData.append('image', {
      uri: image.uri,
      name: getUploadFileName(image),
      type: image.mimeType || 'image/jpeg',
    });

    return unwrap(await apiClient.post('/carbon-records', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }));
  },

  getRecords: async (params = {}) => {
    const response = await apiClient.get('/carbon-track/transactions', { params });
    return {
      records: response.data?.data || [],
      pagination: response.data?.pagination || null,
    };
  },

  getRecord: async (id) => unwrap(await apiClient.get(`/carbon-track/transactions/${id}`)),
};
