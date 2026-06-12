const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildThermalReceiptSummary,
  createReceiptFromSubmission,
} = require('./thermalReceipt');

test('createReceiptFromSubmission keeps submission details needed by the mobile receipt', () => {
  const receipt = createReceiptFromSubmission({
    result: {
      record_id: 'rec-42',
      carbon_saved: 3.125,
      points_earned: 18,
      images: [{ url: 'https://example.test/proof.jpg' }],
    },
    variables: {
      activityId: 'bike',
      amount: 2.5,
      date: '2026-05-02',
      checkinDate: '2026-05-01',
      description: 'Rode to school',
      image: { uri: 'file:///proof.jpg' },
      unit: 'km',
    },
    activity: {
      id: 'bike',
      name_zh: '骑行',
      name_en: 'Cycling',
      category: 'transport',
      carbon_factor: 1.25,
      unit: 'km',
    },
    submittedAt: '2026-05-03T08:30:00.000Z',
  });

  assert.equal(receipt.record_id, 'rec-42');
  assert.equal(receipt.amount, 2.5);
  assert.equal(receipt.date, '2026-05-02');
  assert.equal(receipt.checkin_date, '2026-05-01');
  assert.equal(receipt.image_count, 1);
  assert.equal(receipt.activity.name_zh, '骑行');
});

test('createReceiptFromSubmission prefers server submission timestamps', () => {
  const receipt = createReceiptFromSubmission({
    result: {
      record_id: 'rec-43',
      created_at: '2026-05-03T09:00:00.000Z',
    },
  });

  assert.equal(receipt.submitted_at, '2026-05-03T09:00:00.000Z');
});

test('buildThermalReceiptSummary mirrors the web receipt copy and formula in Chinese', () => {
  const summary = buildThermalReceiptSummary({
    receipt: {
      record_id: 'rec-42',
      amount: 2.5,
      carbon_saved: 3.125,
      points_earned: 18,
      date: '2026-05-02',
      checkin_date: '2026-05-01',
      submitted_at: '2026-05-03T08:30:00.000Z',
      description: '',
      image_count: 1,
      activity: {
        name_zh: '骑行',
        name_en: 'Cycling',
        category: 'transport',
        carbon_factor: 1.25,
        unit: 'km',
      },
    },
    language: 'zh',
    t: (key, params = {}) => {
      const values = {
        'record.receipt.untitledActivity': '未命名活动',
        'record.receipt.uncategorized': '未分类',
        'record.unitFallback': '单位',
        'record.receipt.descriptionFallback': '无附加备注。',
        'record.receipt.files': '{{count}} 张',
      };
      return (values[key] || key).replace('{{count}}', params.count);
    },
  });

  assert.equal(summary.successEyebrow, 'THERMAL RECEIPT');
  assert.equal(summary.receiptTitle, '减碳核算回执');
  assert.equal(summary.activityName, '骑行');
  assert.equal(summary.checkinDate, '2026/05/01');
  assert.equal(summary.descriptionValue, '无附加备注。');
  assert.match(summary.formulaLine, /2\.5 km x 1\.2500 = 3\.13 kg CO2/);
  assert.deepEqual(
    summary.printLines.map((line) => line.label),
    ['活动项目', '分类', '提交数值', '减排系数', '活动日期', '补签日期'],
  );
});
