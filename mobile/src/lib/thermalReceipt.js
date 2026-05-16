const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const interpolate = (value, params = {}) => String(value).replace(/\{\{(\w+)\}\}/g, (_, name) => (
  params[name] === undefined || params[name] === null ? '' : String(params[name])
));

const translate = (t, key, fallback, params = {}) => {
  if (typeof t !== 'function') {
    return interpolate(fallback, params);
  }
  const value = t(key, params);
  if (!value || value === key) {
    return interpolate(fallback, params);
  }
  return value;
};

const safeNumber = (value, fallback = 0) => {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const normalizeLanguage = (language) => (
  String(language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en'
);

const getLocale = (language) => (normalizeLanguage(language) === 'zh' ? 'zh-CN' : 'en-US');

const formatNumber = (value, language, options = {}) => (
  new Intl.NumberFormat(getLocale(language), options).format(safeNumber(value))
);

const parseDateParts = (value) => {
  const match = DATE_ONLY_PATTERN.exec(String(value || '').trim());
  if (match) {
    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
      hours: null,
      minutes: null,
    };
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hours: date.getHours(),
    minutes: date.getMinutes(),
  };
};

const pad = (value) => String(value).padStart(2, '0');

const formatDate = (value, includeTime = false) => {
  if (!value) {
    return '--';
  }

  const parts = parseDateParts(value);
  if (!parts) {
    return String(value);
  }

  const dateLine = `${parts.year}/${pad(parts.month)}/${pad(parts.day)}`;
  if (!includeTime || parts.hours === null || parts.minutes === null) {
    return dateLine;
  }
  return `${dateLine} ${pad(parts.hours)}:${pad(parts.minutes)}`;
};

const getActivityName = (activity, language, t) => {
  if (!activity) {
    return translate(
      t,
      'record.receipt.untitledActivity',
      normalizeLanguage(language) === 'zh' ? '未命名活动' : 'Untitled activity',
    );
  }

  if (normalizeLanguage(language) === 'zh') {
    return activity.name_zh || activity.name_en || activity.name || activity.combined_name || translate(t, 'record.receipt.untitledActivity', '未命名活动');
  }
  return activity.name_en || activity.name_zh || activity.name || activity.combined_name || translate(t, 'record.receipt.untitledActivity', 'Untitled activity');
};

const getUnitName = (unit, t) => {
  if (!unit) {
    return translate(t, 'record.unitFallback', 'unit');
  }
  const translated = translate(t, `units.${unit}`, unit);
  return translated === `units.${unit}` ? unit : translated;
};

const getImageCount = (receipt) => {
  if (Array.isArray(receipt?.images)) {
    return receipt.images.length;
  }
  return safeNumber(receipt?.image_count);
};

function createReceiptFromSubmission({
  activity,
  result,
  submittedAt,
  variables,
} = {}) {
  const payload = result?.data && typeof result.data === 'object' ? result.data : (result || {});
  const calculation = result?.calculation || payload?.calculation || {};
  const images = Array.isArray(payload.images)
    ? payload.images
    : (variables?.image ? [variables.image] : []);

  return {
    record_id: payload.record_id || payload.id || result?.record_id || '--',
    amount: safeNumber(variables?.amount ?? payload.amount),
    carbon_saved: safeNumber(payload.carbon_saved ?? calculation.carbon_saved),
    points_earned: safeNumber(payload.points_earned ?? calculation.points_earned),
    date: variables?.date || payload.date || '',
    checkin_date: variables?.checkinDate || variables?.checkin_date || payload.checkin_date || null,
    description: variables?.description || payload.description || '',
    images,
    image_count: images.length || safeNumber(payload.image_count),
    submitted_at: submittedAt || payload.submitted_at || payload.created_at || new Date().toISOString(),
    status: payload.status || 'pending',
    activity: activity ? { ...activity } : (payload.activity || null),
  };
}

function buildThermalReceiptSummary({ language = 'en', receipt, t } = {}) {
  const normalizedLanguage = normalizeLanguage(language);
  const isZh = normalizedLanguage === 'zh';
  const activity = receipt?.activity || null;
  const amount = safeNumber(receipt?.amount);
  const factor = safeNumber(activity?.carbon_factor);
  const carbonSaved = safeNumber(receipt?.carbon_saved);
  const imageCount = getImageCount(receipt);
  const unitName = getUnitName(activity?.unit || receipt?.unit, t);
  const activityName = getActivityName(activity, normalizedLanguage, t);
  const categoryFallback = activity?.category || (isZh ? '未分类' : 'Uncategorized');
  const categoryName = translate(t, `store.categories.${activity?.category}`, categoryFallback);
  const amountNumber = formatNumber(amount, normalizedLanguage, {
    maximumFractionDigits: 2,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 1,
  });
  const factorNumber = formatNumber(factor, normalizedLanguage, {
    maximumFractionDigits: 4,
    minimumFractionDigits: 4,
  });
  const carbonNumber = formatNumber(carbonSaved, normalizedLanguage, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
  const checkinDate = receipt?.checkin_date ? formatDate(receipt.checkin_date) : '';
  const descriptionValue = String(receipt?.description || '').trim()
    || translate(t, 'record.receipt.descriptionFallback', isZh ? '无附加备注。' : 'No extra note.');

  const labels = {
    activity: translate(t, 'record.receipt.activityLabel', isZh ? '活动项目' : 'Activity'),
    category: translate(t, 'record.receipt.categoryLabel', isZh ? '分类' : 'Category'),
    amount: translate(t, 'record.receipt.amountLabel', isZh ? '提交数值' : 'Submitted amount'),
    factor: translate(t, 'record.receipt.factorLabel', isZh ? '减排系数' : 'Carbon factor'),
    activityDate: translate(t, 'record.receipt.activityDateLabel', isZh ? '活动日期' : 'Activity date'),
    checkin: translate(t, 'record.receipt.checkinLabel', isZh ? '补签日期' : 'Check-in date'),
    submittedAt: translate(t, 'record.receipt.submittedAtLabel', isZh ? '提交时间' : 'Submitted at'),
    imageCount: translate(t, 'record.receipt.imageCountLabel', isZh ? '凭证张数' : 'Proof images'),
  };

  const amountLine = `${amountNumber} ${unitName}`;
  const factorLine = `${factorNumber} kg CO2e / ${unitName}`;
  const formulaLine = `${amountNumber} ${unitName} x ${factorNumber} = ${carbonNumber} kg CO2e`;
  const imageCountLine = translate(
    t,
    'record.receipt.files',
    isZh ? '{{count}} 张' : '{{count}} files',
    { count: imageCount },
  );
  const printLines = [
    { label: labels.activity, value: activityName },
    { label: labels.category, value: categoryName },
    { label: labels.amount, value: amountLine },
    { label: labels.factor, value: factorLine },
    { label: labels.activityDate, value: formatDate(receipt?.date) },
  ];

  if (checkinDate) {
    printLines.push({ label: labels.checkin, value: checkinDate });
  }

  return {
    successEyebrow: translate(t, 'record.receipt.successEyebrow', 'THERMAL RECEIPT'),
    successTitle: translate(t, 'record.submitSuccessTitle', isZh ? '已提交' : 'Submitted'),
    successDescription: translate(
      t,
      'record.receipt.successDescription',
      isZh
        ? '核算详情已生成热敏小票，你可以直接查看完整记录。'
        : 'The calculation details are now printed on a thermal-style receipt for review.',
    ),
    receiptTitle: translate(t, 'record.receipt.title', isZh ? '减碳核算回执' : 'Carbon Reduction Receipt'),
    recordId: receipt?.record_id || '--',
    activityName,
    categoryName,
    amountLine,
    factorLine,
    activityDate: formatDate(receipt?.date),
    checkinDate,
    submittedAt: formatDate(receipt?.submitted_at, true),
    imageCount: imageCountLine,
    formulaLabel: translate(t, 'record.receipt.formulaLabel', isZh ? '核算公式' : 'Calculation formula'),
    formulaLine,
    descriptionLabel: translate(t, 'record.receipt.descriptionLabel', isZh ? '备注 / 审核提示' : 'Notes / review memo'),
    descriptionValue,
    footerLineOne: translate(
      t,
      'record.receipt.footerLineOne',
      isZh ? '此回执已进入人工审核队列，请保留凭证。' : 'This receipt is queued for manual review. Keep your proof ready.',
    ),
    footerLineTwo: translate(t, 'record.receipt.footerLineTwo', 'CarbonTrack · thermal log snapshot'),
    labels,
    actions: {
      restart: translate(t, 'record.receipt.recordAnother', isZh ? '继续记录下一条' : 'Record another'),
      home: translate(t, 'record.receipt.goHome', isZh ? '返回首页' : 'Go home'),
    },
    printLines,
  };
}

module.exports = {
  buildThermalReceiptSummary,
  createReceiptFromSubmission,
  formatDate,
};
