import apiClient from './client';

const {
  normalizeTicketDetail,
  normalizeTicketsPayload,
} = require('../lib/userContent');

const unwrap = (response) => response.data?.data ?? response.data;

export const ticketApi = {
  list: async (params = {}) => normalizeTicketsPayload(unwrap(await apiClient.get('/tickets', { params }))),
  create: async (payload) => normalizeTicketDetail(unwrap(await apiClient.post('/tickets', payload))),
  get: async (ticketId) => normalizeTicketDetail(unwrap(await apiClient.get(`/tickets/${ticketId}`))),
  reply: async (ticketId, payload) => normalizeTicketDetail(unwrap(await apiClient.post(`/tickets/${ticketId}/messages`, payload))),
  submitFeedback: async (ticketId, payload) => unwrap(await apiClient.post(`/tickets/${ticketId}/feedback`, payload)),
};
