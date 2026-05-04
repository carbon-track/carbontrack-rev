const assert = require('node:assert/strict');
const test = require('node:test');

const {
  normalizeMessagesPayload,
  normalizeNotificationPreferences,
  normalizeTicketDetail,
  serializeNotificationPreferences,
  validateTicketDraft,
} = require('./userContent');

test('normalizeMessagesPayload accepts CarbonTrack paginated message responses', () => {
  const payload = normalizeMessagesPayload({
    data: [
      { id: 1, title: 'Welcome', is_read: false, created_at: '2026-05-03 08:00:00' },
      { id: 2, subject: 'Reviewed', read_at: '2026-05-03 09:00:00' },
    ],
    pagination: { page: 2, pages: 5, total: 42 },
    unread_count: 7,
  });

  assert.equal(payload.messages.length, 2);
  assert.equal(payload.messages[0].title, 'Welcome');
  assert.equal(payload.messages[0].isRead, false);
  assert.equal(payload.messages[1].title, 'Reviewed');
  assert.equal(payload.messages[1].isRead, true);
  assert.deepEqual(payload.pagination, { page: 2, pages: 5, total: 42 });
  assert.equal(payload.unreadCount, 7);
});

test('normalizeTicketDetail preserves thread messages and image attachment metadata', () => {
  const detail = normalizeTicketDetail({
    id: 9,
    subject: 'Cannot upload proof',
    status: 'waiting_user',
    priority: 'high',
    messages: [
      {
        id: 10,
        body: 'Please attach a screenshot.',
        sender_role: 'support',
        attachments: [
          {
            file_path: 'support-tickets/proof.png',
            original_name: 'proof.png',
            mime_type: 'image/png',
            public_url: 'https://cdn.example/proof.png',
          },
        ],
      },
    ],
  });

  assert.equal(detail.id, 9);
  assert.equal(detail.messages.length, 1);
  assert.equal(detail.messages[0].senderRole, 'support');
  assert.equal(detail.messages[0].attachments[0].isImage, true);
  assert.equal(detail.messages[0].attachments[0].url, 'https://cdn.example/proof.png');
});

test('normalizeNotificationPreferences gives stable editable rows', () => {
  const preferences = normalizeNotificationPreferences({
    preferences: [
      { category: 'system', enabled: 1, locked: true },
      { category: 'review', email_enabled: false },
    ],
  });

  assert.deepEqual(preferences, [
    { category: 'system', enabled: true, locked: true },
    { category: 'review', enabled: false, locked: false },
  ]);
});

test('serializeNotificationPreferences sends backend email_enabled flags', () => {
  const preferences = normalizeNotificationPreferences({
    preferences: [
      { category: 'review', email_enabled: false },
      { category: 'system', enabled: true, locked: true },
    ],
  });

  assert.deepEqual(serializeNotificationPreferences(preferences), [
    { category: 'review', email_enabled: false },
    { category: 'system', email_enabled: true },
  ]);
});

test('validateTicketDraft returns localized validation keys before submitting', () => {
  assert.deepEqual(validateTicketDraft({ subject: '', content: '' }), {
    subject: 'support.validation.subjectRequired',
    content: 'support.validation.contentRequired',
  });

  assert.deepEqual(validateTicketDraft({ subject: 'Need help', content: 'Please check this.' }), {});
});
