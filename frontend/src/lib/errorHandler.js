// Global error helper: extracts request_id and forms user-facing message
import { toast } from 'react-hot-toast';

export function notifyApiError(error, fallbackMessage = '请求失败') {
  const rid = error?.request_id || error?.response?.data?.request_id;
  const code = error?.response?.status;
  const base = fallbackMessage || '请求失败';
  if (rid) {
    toast.error(`${base} (请联系管理员并提供请求ID: ${rid})`);
  } else if (code) {
    toast.error(`${base} (HTTP ${code})`);
  } else {
    toast.error(base);
  }
}

export function extractRequestId(error) {
  return error?.request_id || error?.response?.data?.request_id || null;
}
