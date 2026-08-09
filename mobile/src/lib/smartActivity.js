const normalizeText = (value) => String(value || '').trim().toLowerCase();

const normalizeAmount = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};

const isValidIsoDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day
  );
};

const activityNames = (activity = {}) => [
  activity.name_en,
  activity.name_zh,
  activity.name,
  activity.combined_name,
  activity.category,
].map(normalizeText).filter(Boolean);

function findSmartActivityMatch(prediction = {}, activities = []) {
  const uuid = prediction.activity_uuid ?? prediction.activity_id ?? prediction.id;
  if (uuid !== undefined && uuid !== null && String(uuid).trim()) {
    const exactMatch = activities.find((activity) => (
      String(activity.id) === String(uuid)
      || String(activity.uuid || '') === String(uuid)
    ));
    if (exactMatch) {
      return exactMatch;
    }
  }

  const predictedName = normalizeText(prediction.activity_name || prediction.activity || prediction.name);
  if (!predictedName) {
    return null;
  }

  return activities.find((activity) => activityNames(activity).some((name) => name === predictedName)) || null;
}

function buildSmartActivityDraft(prediction = {}, activities = []) {
  const activity = findSmartActivityMatch(prediction, activities);
  if (!activity) {
    return { activity: null, draft: null };
  }

  const amount = normalizeAmount(prediction.amount);
  const activityDate = isValidIsoDate(prediction.activity_date) ? prediction.activity_date : null;
  const description = String(prediction.notes || prediction.description || '').trim();

  return {
    activity,
    draft: {
      activityId: String(activity.id || activity.uuid || ''),
      amount: amount === null ? '' : String(amount),
      date: activityDate,
      description,
      unit: prediction.unit || activity.unit || '',
      confidence: Number.isFinite(Number(prediction.confidence)) ? Number(prediction.confidence) : null,
    },
  };
}

module.exports = {
  buildSmartActivityDraft,
  findSmartActivityMatch,
  isValidIsoDate,
};
