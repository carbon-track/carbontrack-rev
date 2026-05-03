const DEFAULT_PAGINATION = { page: 1, pages: 1, total: 0 };

const unwrapPayload = (payload) => {
  if (payload && typeof payload === 'object' && 'data' in payload && !Array.isArray(payload)) {
    return payload.data;
  }
  return payload;
};

const asArray = (value) => (Array.isArray(value) ? value : []);

const asBoolean = (value) => value === true || value === 1 || value === '1';

const normalizePagination = (pagination, fallbackTotal = 0) => ({
  page: Number(pagination?.page ?? 1),
  pages: Number(pagination?.pages ?? pagination?.total_pages ?? 1),
  total: Number(pagination?.total ?? fallbackTotal),
});

const normalizeMessage = (message = {}) => ({
  ...message,
  id: message.id,
  title: message.title || message.subject || message.type || '',
  content: message.content || message.body || message.message || '',
  isRead: asBoolean(message.is_read) || Boolean(message.read_at),
  createdAt: message.created_at || message.createdAt || '',
});

function normalizeMessagesPayload(payload) {
  const source = unwrapPayload(payload) || {};
  const list = Array.isArray(source)
    ? source
    : asArray(source.messages || source.items || source.data);

  return {
    messages: list.map(normalizeMessage),
    pagination: normalizePagination(source.pagination || payload?.pagination, list.length),
    unreadCount: Number(source.unread_count ?? payload?.unread_count ?? list.filter((item) => !normalizeMessage(item).isRead).length),
  };
}

const isImageAttachment = (attachment = {}) => {
  const mimeType = String(attachment.mime_type || attachment.mimeType || '').toLowerCase();
  const filePath = String(attachment.file_path || attachment.path || attachment.original_name || '').toLowerCase();
  return mimeType.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(filePath);
};

const normalizeAttachment = (attachment = {}) => {
  const filePath = attachment.file_path || attachment.path || '';
  const url = attachment.download_url || attachment.public_url || attachment.url || filePath;
  return {
    ...attachment,
    filePath,
    id: attachment.id ?? filePath,
    isImage: isImageAttachment(attachment),
    mimeType: attachment.mime_type || attachment.mimeType || '',
    name: attachment.original_name || attachment.originalName || filePath.split('/').pop() || 'attachment',
    url,
  };
};

const normalizeTicketMessage = (message = {}) => ({
  ...message,
  attachments: asArray(message.attachments).map(normalizeAttachment),
  body: message.body || message.content || '',
  createdAt: message.created_at || message.createdAt || '',
  id: message.id,
  senderName: message.sender_name || message.senderName || '',
  senderRole: message.sender_role || message.senderRole || 'user',
});

const normalizeTicket = (ticket = {}) => ({
  ...ticket,
  category: ticket.category || 'other',
  createdAt: ticket.created_at || ticket.createdAt || '',
  id: ticket.id,
  lastRepliedAt: ticket.last_replied_at || ticket.updated_at || ticket.created_at || '',
  priority: ticket.priority || 'normal',
  status: ticket.status || 'open',
  subject: ticket.subject || ticket.title || '',
});

function normalizeTicketsPayload(payload) {
  const source = unwrapPayload(payload) || {};
  const list = Array.isArray(source)
    ? source
    : asArray(source.tickets || source.items || source.data);

  return {
    pagination: normalizePagination(source.pagination || payload?.pagination, list.length),
    tickets: list.map(normalizeTicket),
  };
}

function normalizeTicketDetail(payload) {
  const source = unwrapPayload(payload) || {};
  return {
    ...normalizeTicket(source),
    feedback: asArray(source.feedback),
    feedbackCandidates: asArray(source.feedback_candidates || source.feedbackCandidates),
    messages: asArray(source.messages).map(normalizeTicketMessage),
    slaSummary: source.sla_summary || source.slaSummary || null,
  };
}

function normalizeNotificationPreferences(payload) {
  const source = unwrapPayload(payload) || {};
  const list = Array.isArray(source)
    ? source
    : asArray(source.preferences || source.items || source.data);

  return list.map((item = {}) => ({
    category: item.category || '',
    enabled: item.enabled !== undefined ? asBoolean(item.enabled) : asBoolean(item.email_enabled),
    locked: asBoolean(item.locked || item.is_locked),
  })).filter((item) => item.category);
}

function validateTicketDraft({ subject, content } = {}) {
  const errors = {};
  if (!String(subject || '').trim()) {
    errors.subject = 'support.validation.subjectRequired';
  }
  if (!String(content || '').trim()) {
    errors.content = 'support.validation.contentRequired';
  }
  return errors;
}

function validatePasswordDraft({ currentPassword, newPassword, confirmPassword } = {}) {
  const errors = {};
  if (!String(currentPassword || '').trim()) {
    errors.currentPassword = 'profile.security.currentPasswordRequired';
  }
  if (String(newPassword || '').length < 8) {
    errors.newPassword = 'profile.security.newPasswordTooShort';
  }
  if (newPassword !== confirmPassword) {
    errors.confirmPassword = 'profile.security.passwordMismatch';
  }
  return errors;
}

module.exports = {
  normalizeAttachment,
  normalizeMessage,
  normalizeMessagesPayload,
  normalizeNotificationPreferences,
  normalizePagination,
  normalizeTicket,
  normalizeTicketDetail,
  normalizeTicketsPayload,
  validatePasswordDraft,
  validateTicketDraft,
};
