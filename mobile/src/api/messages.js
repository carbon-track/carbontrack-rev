import apiClient from './client';
import { normalizeMessagesPayload, normalizeMessage, normalizeUnreadCount } from '../lib/userContent';

const unwrap = (response) => response.data?.data ?? response.data;

export const messageApi = {
  getMessages: async (params = {}) => {
    const response = await apiClient.get('/messages', { params });
    return normalizeMessagesPayload(response.data);
  },
  getMessage: async (id) => normalizeMessage(unwrap(await apiClient.get(`/messages/${id}`))),
  getUnreadCount: async () => {
    const payload = unwrap(await apiClient.get('/messages/unread-count'));
    return normalizeUnreadCount(payload);
  },
  markAsRead: async (id) => unwrap(await apiClient.put(`/messages/${id}/read`)),
  markAllAsRead: async () => unwrap(await apiClient.put('/messages/mark-all-read')),
  deleteMessage: async (id) => unwrap(await apiClient.delete(`/messages/${id}`)),
};
