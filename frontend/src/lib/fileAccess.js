import api from './api';

// 简单内存缓存：file_path -> { url, expiresAt }
const cache = new Map();

function now() { return Date.now(); }

/**
 * 获取私有文件临时访问URL（若已缓存且未过期直接返回）
 * @param {string} filePath 对象key（存储的 file_path）
 * @param {number} ttlSeconds 期望有效秒数(默认600，后端最大可能不同)
 */
export async function getPresignedReadUrl(filePath, ttlSeconds = 600) {
  if (!filePath) throw new Error('filePath required');
  const cached = cache.get(filePath);
  if (cached && cached.expiresAt > now() + 5000) { // 留5秒安全余量
    return cached.url;
  }
  // 后端路由: GET /api/v1/files/{path}/presigned-url?expires_in=xxx  (需要URL编码)
  const encoded = encodeURIComponent(filePath);
  const res = await api.get(`/files/${encoded}/presigned-url`, { params: { expires_in: ttlSeconds } });
  if (!res.data?.success) throw new Error(res.data?.message || '获取签名失败');
  const { presigned_url, expires_in } = res.data.data;
  const record = { url: presigned_url, expiresAt: now() + (expires_in * 1000) };
  cache.set(filePath, record);
  return presigned_url;
}

/**
 * 预取多个，减少后续延迟
 */
export async function prefetchPresignedUrls(filePaths = [], ttlSeconds = 600) {
  const tasks = filePaths.filter(p => p && (!cache.get(p) || cache.get(p).expiresAt <= now() + 5000))
    .map(p => getPresignedReadUrl(p, ttlSeconds).catch(()=>null));
  await Promise.all(tasks);
}

/**
 * 简单失效：清空或按文件路径删除
 */
export function invalidateFileUrl(filePath) {
  if (filePath) cache.delete(filePath); else cache.clear();
}

export default { getPresignedReadUrl, prefetchPresignedUrls, invalidateFileUrl };
