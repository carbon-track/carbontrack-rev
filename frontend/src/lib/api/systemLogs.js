import api from '../api';

// 基础列表查询
export async function fetchSystemLogs(params = {}) {
  const { page = 1, limit = 20, method, status_code, user_id, path, request_id, date_from, date_to } = params;
  const query = new URLSearchParams();
  query.append('page', page);
  query.append('limit', limit);
  if (method) query.append('method', method);
  if (status_code) query.append('status_code', status_code);
  if (user_id) query.append('user_id', user_id);
  if (path) query.append('path', path);
  if (request_id) query.append('request_id', request_id);
  if (date_from) query.append('date_from', date_from);
  if (date_to) query.append('date_to', date_to);
  // 使用统一 api 实例；路径不再硬编码协议主机，保持与 baseURL 拼接
  const res = await api.get(`/admin/system-logs?${query.toString()}`);
  return res.data;
}

// 详情
export async function fetchSystemLogDetail(id) {
  const res = await api.get(`/admin/system-logs/${id}`);
  return res.data;
}
