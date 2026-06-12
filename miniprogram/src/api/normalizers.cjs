const asNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const asArray = (value) => (Array.isArray(value) ? value : []);

const defaultPagination = (items = []) => ({
  page: 1,
  pages: 1,
  total: items.length,
});

const unwrapData = (payload) => {
  if (payload && typeof payload === 'object' && 'data' in payload && !Array.isArray(payload)) {
    return payload.data;
  }
  return payload;
};

const normalizeStatsPayload = (payload = {}) => {
  const stats = unwrapData(payload) || {};
  return {
    totalPoints: asNumber(stats.total_points ?? stats.current_points ?? stats.points),
    carbonSaved: asNumber(stats.carbon_saved ?? stats.total_carbon_saved),
    recordsCount: asNumber(stats.records_count ?? stats.total_activities),
  };
};

const normalizeRecordsPayload = (payload = {}) => {
  const data = unwrapData(payload);
  const records = Array.isArray(data)
    ? data
    : asArray(data?.records ?? data?.transactions ?? payload?.records ?? payload?.transactions ?? payload?.data);
  return {
    records,
    pagination: payload?.pagination || data?.pagination || defaultPagination(records),
  };
};

const normalizeProductsPayload = (payload = {}) => {
  const data = unwrapData(payload);
  const products = Array.isArray(data)
    ? data
    : asArray(data?.products ?? payload?.products);
  return {
    products,
    pagination: data?.pagination || payload?.pagination || defaultPagination(products),
  };
};

const normalizeExchangesPayload = (payload = {}) => {
  const data = unwrapData(payload);
  const exchanges = Array.isArray(data)
    ? data
    : asArray(data?.exchanges ?? data?.transactions ?? payload?.exchanges ?? payload?.data);
  return {
    exchanges,
    pagination: payload?.pagination || data?.pagination || defaultPagination(exchanges),
  };
};

module.exports = {
  normalizeExchangesPayload,
  normalizeProductsPayload,
  normalizeRecordsPayload,
  normalizeStatsPayload,
};
