const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeExchangesPayload,
  normalizeProductsPayload,
  normalizeRecordsPayload,
  normalizeStatsPayload,
} = require('./normalizers.cjs');

test('normalizeStatsPayload keeps useful totals with numeric fallbacks', () => {
  const stats = normalizeStatsPayload({
    total_points: '42',
    carbon_saved: '7.5',
    records_count: null,
  });

  assert.deepEqual(stats, {
    totalPoints: 42,
    carbonSaved: 7.5,
    recordsCount: 0,
  });
});

test('normalizeRecordsPayload accepts data arrays and pagination metadata', () => {
  const payload = normalizeRecordsPayload({
    data: [{ id: 'a' }],
    pagination: { page: 2, total: 5 },
  });

  assert.deepEqual(payload.records, [{ id: 'a' }]);
  assert.equal(payload.pagination.page, 2);
  assert.equal(payload.pagination.total, 5);
});

test('normalizeProductsPayload handles both array and object payloads', () => {
  assert.deepEqual(normalizeProductsPayload([{ id: 1 }]).products, [{ id: 1 }]);
  assert.deepEqual(normalizeProductsPayload({ products: [{ id: 2 }] }).products, [{ id: 2 }]);
});

test('normalizeExchangesPayload exposes exchanges and safe pagination', () => {
  const payload = normalizeExchangesPayload({ data: [{ id: 'tx' }] });

  assert.deepEqual(payload.exchanges, [{ id: 'tx' }]);
  assert.deepEqual(payload.pagination, { page: 1, pages: 1, total: 1 });
});
