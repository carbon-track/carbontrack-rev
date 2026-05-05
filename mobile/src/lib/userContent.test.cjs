const assert = require('node:assert/strict');
const test = require('node:test');

const {
  normalizeMessagesPayload,
  normalizeNotificationPreferences,
  normalizePasskeysPayload,
  normalizeSecurityActivityPayload,
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

test('normalizeNotificationPreferences gives stable editable rows with defaults and switch fields', () => {
  const preferences = normalizeNotificationPreferences({
    preferences: {
      system: { email_enabled: 1, locked: true },
      transaction: { email_enabled: false },
    },
  });

  assert.deepEqual(preferences.map((item) => item.category), [
    'verification',
    'security',
    'system',
    'transaction',
    'activity',
    'announcement',
    'message',
    'support',
  ]);
  assert.equal(preferences[2].emailEnabled, true);
  assert.equal(preferences[2].enabled, true);
  assert.equal(preferences[2].locked, true);
  assert.equal(preferences[3].emailEnabled, false);
  assert.equal(preferences[7].emailEnabled, true);
});

test('normalizeSecurityActivityPayload accepts backend timeline envelopes', () => {
  const payload = normalizeSecurityActivityPayload({
    items: [{ id: 3, action: 'password_changed' }],
    pagination: { current_page: 1, total_items: 1, total_pages: 1 },
  });

  assert.equal(payload.items.length, 1);
  assert.equal(payload.items[0].action, 'password_changed');
  assert.deepEqual(payload.pagination, { page: 1, pages: 1, total: 1 });
});

test('normalizePasskeysPayload accepts current-user passkey envelopes', () => {
  const passkeys = normalizePasskeysPayload({
    passkeys: [{ id: 5, label: 'Phone', last_used_at: '2026-05-04 10:00:00' }],
  });

  assert.equal(passkeys.length, 1);
  assert.equal(passkeys[0].label, 'Phone');
  assert.equal(passkeys[0].last_used_at, '2026-05-04 10:00:00');
});

test('serializeNotificationPreferences sends backend email_enabled flags', () => {
  const preferences = normalizeNotificationPreferences({
    preferences: [
      { category: 'transaction', email_enabled: false },
      { category: 'system', enabled: true, locked: true },
    ],
  });

  const serialized = serializeNotificationPreferences(preferences);
  assert.deepEqual(serialized.map((item) => item.category), [
    'verification',
    'security',
    'system',
    'transaction',
    'activity',
    'announcement',
    'message',
    'support',
  ]);
  assert.equal(serialized.find((item) => item.category === 'transaction').email_enabled, false);
  assert.equal(serialized.find((item) => item.category === 'system').email_enabled, true);
});

test('validateTicketDraft returns localized validation keys before submitting', () => {
  assert.deepEqual(validateTicketDraft({ subject: '', content: '' }), {
    subject: 'support.validation.subjectRequired',
    content: 'support.validation.contentRequired',
  });

  assert.deepEqual(validateTicketDraft({ subject: 'Need help', content: 'Please check this.' }), {});
});
