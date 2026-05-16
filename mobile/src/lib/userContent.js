const DEFAULT_PAGINATION = { page: 1, pages: 1, total: 0 };
const DEFAULT_NOTIFICATION_CATEGORIES = [
  'verification',
  'security',
  'system',
  'transaction',
  'activity',
  'announcement',
  'message',
  'support',
];
const NOTIFICATION_CATEGORY_ALIASES = {
  activity_review: 'activity',
  activity_reviews: 'activity',
  carbon_record: 'activity',
  carbon_records: 'activity',
  review: 'activity',
  reviews: 'activity',
};

const unwrapPayload = (payload) => {
  if (payload && typeof payload === 'object' && 'data' in payload && !Array.isArray(payload)) {
    return payload.data;
  }
  return payload;
};

const asArray = (value) => (Array.isArray(value) ? value : []);

const asBoolean = (value) => value === true || value === 1 || value === '1';

const normalizeNotificationCategory = (category) => {
  const key = String(category || '').trim().toLowerCase();
  return NOTIFICATION_CATEGORY_ALIASES[key] || key;
};

const normalizePagination = (pagination, fallbackTotal = 0) => ({
  page: Number(pagination?.page ?? pagination?.current_page ?? DEFAULT_PAGINATION.page),
  pages: Number(pagination?.pages ?? pagination?.total_pages ?? DEFAULT_PAGINATION.pages),
  total: Number(pagination?.total ?? pagination?.total_items ?? fallbackTotal),
});

const normalizeMessage = (message = {}) => ({
  ...message,
  id: message.id,
  title: message.title || message.subject || message.type || '',
  content: message.content || message.body || message.message || '',
  isRead: asBoolean(message.is_read) || Boolean(message.read_at),
  createdAt: message.created_at || message.createdAt || '',
});

const normalizeUnreadCount = (payload) => Number(
  payload?.total_unread
    ?? payload?.unread_count
    ?? payload?.count
    ?? payload
    ?? 0,
);

const messageFilterParams = (filter) => (
  filter === 'unread' ? { status: 'unread' } : {}
);

function normalizeMessagesPayload(payload) {
  const source = unwrapPayload(payload) || {};
  const list = Array.isArray(source)
    ? source
    : asArray(source.messages || source.items || source.data);
  const unreadCount = source.total_unread
    ?? source.unread_count
    ?? source.count
    ?? payload?.total_unread
    ?? payload?.unread_count
    ?? payload?.count;

  return {
    messages: list.map(normalizeMessage),
    pagination: normalizePagination(source.pagination || payload?.pagination, list.length),
    unreadCount: unreadCount === undefined
      ? list.filter((item) => !normalizeMessage(item).isRead).length
      : normalizeUnreadCount(unreadCount),
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
  const preferences = source.preferences || source.items || source.data || source;
  const byCategory = {};
  if (Array.isArray(preferences)) {
    preferences.forEach((item = {}) => {
      const category = normalizeNotificationCategory(item.category);
      if (category && !byCategory[category]) {
        byCategory[category] = { ...item, category };
      }
    });
  } else if (preferences && typeof preferences === 'object') {
    Object.entries(preferences).forEach(([category, value]) => {
      const normalizedCategory = normalizeNotificationCategory(category);
      if (normalizedCategory && !byCategory[normalizedCategory]) {
        byCategory[normalizedCategory] = {
          category: normalizedCategory,
          ...(value && typeof value === 'object' ? value : { enabled: value }),
        };
      }
    });
  }

  const categories = Array.from(new Set([...DEFAULT_NOTIFICATION_CATEGORIES, ...Object.keys(byCategory)]));
  return categories.map((category) => {
    const item = byCategory[category] || {};
    const emailEnabled = item.email_enabled ?? item.emailEnabled ?? item.enabled ?? item.is_enabled ?? true;
    return {
      category,
      label: item.label || '',
      emailEnabled: asBoolean(emailEnabled),
      pushEnabled: asBoolean(item.push_enabled ?? item.pushEnabled),
      enabled: asBoolean(emailEnabled),
      locked: asBoolean(item.locked || item.is_locked),
    };
  }).filter((item) => item.category);
}

function normalizeSecurityActivityPayload(payload) {
  const source = unwrapPayload(payload) || {};
  const list = Array.isArray(source)
    ? source
    : asArray(source.items || source.activities || source.data);

  return {
    filters: source.filters || {},
    items: list,
    pagination: normalizePagination(source.pagination || payload?.pagination, list.length),
  };
}

function normalizePasskeysPayload(payload) {
  const source = unwrapPayload(payload) || {};
  return (Array.isArray(source)
    ? source
    : asArray(source.passkeys || source.items || source.data)).map((item = {}) => ({
    ...item,
    id: item.id,
    label: item.label || '',
    last_used_at: item.last_used_at || item.lastUsedAt || '',
    created_at: item.created_at || item.createdAt || '',
    locked: asBoolean(item.locked || item.is_locked),
  }));
}

function serializeNotificationPreferences(preferences) {
  const source = Array.isArray(preferences)
    ? preferences
    : asArray(preferences?.preferences || preferences?.items || preferences?.data);

  return source.map((item = {}) => ({
    category: normalizeNotificationCategory(item.category),
    email_enabled: item.email_enabled !== undefined
      ? asBoolean(item.email_enabled)
      : asBoolean(item.emailEnabled ?? item.enabled),
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
  messageFilterParams,
  normalizeAttachment,
  normalizeMessage,
  normalizeMessagesPayload,
  normalizeNotificationPreferences,
  normalizePagination,
  normalizePasskeysPayload,
  normalizeSecurityActivityPayload,
  normalizeTicket,
  normalizeTicketDetail,
  normalizeTicketsPayload,
  normalizeUnreadCount,
  serializeNotificationPreferences,
  validatePasswordDraft,
  validateTicketDraft,
};
