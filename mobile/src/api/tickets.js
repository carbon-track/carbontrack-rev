import apiClient from './client';
import { withMobileProofOfWork } from './pow';
import {
  normalizeTicketDetail,
  normalizeTicketsPayload,
} from '../lib/userContent';

const unwrap = (response) => response.data?.data ?? response.data;

export const ticketApi = {
  list: async (params = {}) => {
    const response = await apiClient.get('/tickets', { params });
    return normalizeTicketsPayload(response.data);
  },
  create: async (payload) => normalizeTicketDetail(unwrap(await apiClient.post(
    '/tickets',
    await withMobileProofOfWork('support.ticket.create', payload),
  ))),
  get: async (ticketId) => normalizeTicketDetail(unwrap(await apiClient.get(`/tickets/${ticketId}`))),
  reply: async (ticketId, payload) => normalizeTicketDetail(unwrap(await apiClient.post(
    `/tickets/${ticketId}/messages`,
    await withMobileProofOfWork('support.ticket.reply', payload),
  ))),
  submitFeedback: async (ticketId, payload) => unwrap(await apiClient.post(`/tickets/${ticketId}/feedback`, payload)),
};
