const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildSmartActivityDraft,
  findSmartActivityMatch,
  isValidIsoDate,
} = require('./smartActivity');

const activities = [
  {
    id: 12,
    uuid: 'bus-uuid',
    name_en: 'Bus Ride',
    name_zh: '公交出行',
    unit: 'km',
  },
  {
    id: 23,
    name_en: 'Reusable Cup',
    name_zh: '自带杯',
    unit: 'times',
  },
];

test('findSmartActivityMatch prefers backend activity uuid', () => {
  const match = findSmartActivityMatch({ activity_uuid: 'bus-uuid', activity_name: 'Reusable Cup' }, activities);
  assert.equal(match.id, 12);
});

test('findSmartActivityMatch falls back to localized exact name', () => {
  const match = findSmartActivityMatch({ activity_name: '自带杯' }, activities);
  assert.equal(match.id, 23);
});

test('buildSmartActivityDraft normalizes positive amount, date, notes, and activity id', () => {
  const result = buildSmartActivityDraft({
    activity_uuid: 'bus-uuid',
    amount: '5.5',
    activity_date: '2026-07-06',
    notes: 'Took the bus to school',
    confidence: '0.83',
  }, activities);

  assert.equal(result.activity.id, 12);
  assert.deepEqual(result.draft, {
    activityId: '12',
    amount: '5.5',
    date: '2026-07-06',
    description: 'Took the bus to school',
    unit: 'km',
    confidence: 0.83,
  });
});

test('buildSmartActivityDraft drops invalid dates and non-positive amounts', () => {
  const result = buildSmartActivityDraft({
    activity_name: 'Bus Ride',
    amount: 0,
    activity_date: '2026-02-31',
  }, activities);

  assert.equal(result.draft.amount, '');
  assert.equal(result.draft.date, null);
});

test('buildSmartActivityDraft reports null draft when no activity matches', () => {
  const result = buildSmartActivityDraft({ activity_name: 'Unknown activity', amount: 1 }, activities);
  assert.equal(result.activity, null);
  assert.equal(result.draft, null);
});

test('isValidIsoDate rejects malformed dates', () => {
  assert.equal(isValidIsoDate('2026-07-06'), true);
  assert.equal(isValidIsoDate('20260706'), false);
  assert.equal(isValidIsoDate('2026-13-06'), false);
});
