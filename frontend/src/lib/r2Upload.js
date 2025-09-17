// Utility for presigned direct uploads to R2
// Import default axios instance
import api from './api';

/**
 * Presign a file for direct PUT upload.
 * @param {File} file
 * @param {Object} options { directory, entityType, entityId, sha256 }
 * @returns {Promise<object>} presign data
 */
export async function presignFile(file, { directory = 'activities', entityType = 'carbon_record', entityId = null, sha256 } = {}) {
  const body = {
    original_name: file.name,
    directory,
    mime_type: file.type || 'application/octet-stream',
    file_size: file.size,
    entity_type: entityType,
    entity_id: entityId,
    sha256
  };
  const res = await api.post('/files/presign', body);
  if (!res.data?.success) throw new Error(res.data?.message || 'Presign failed');
  return res.data.data;
}

/**
 * Direct PUT upload to R2 using presigned URL.
 * @param {File} file
 * @param {object} presign { url, headers }
 */
export async function putFile(file, presign) {
  const headers = new Headers(presign.headers || {});
  if (!headers.has('Content-Type') && file.type) headers.set('Content-Type', file.type);
  const resp = await fetch(presign.url, { method: 'PUT', body: file, headers });
  if (!resp.ok) throw new Error('PUT upload failed');
  return true;
}

/**
 * Confirm upload so backend can record metadata (if required)
 * @param {object} meta { file_path, original_name, entity_type, entity_id }
 */
export async function confirmUpload(meta) {
  const res = await api.post('/files/confirm', meta);
  if (!res.data?.success) throw new Error(res.data?.message || 'Confirm failed');
  return res.data.data;
}

/**
 * Full pipeline: presign -> PUT -> confirm (skip confirm if duplicate or no confirm flag)
 * Returns normalized image object with url + meta
 */
export async function uploadViaPresign(file, opts = {}) {
  const presign = await presignFile(file, opts);
  if (presign.duplicate) {
    // Duplicate: already stored; no PUT needed
    return {
      url: presign.public_url,
      file_path: presign.file_path,
      original_name: file.name,
      mime_type: file.type,
      size: file.size,
      duplicate: true
    };
  }
  await putFile(file, presign);
  if (presign.confirm_required) {
    try {
      await confirmUpload({
        file_path: presign.file_path,
        original_name: file.name,
        entity_type: opts.entityType || 'carbon_record',
        entity_id: opts.entityId || null
      });
    } catch (e) {
      // Soft fail confirm so user not blocked
  console.warn('Confirm upload failed', e);
    }
  }
  return {
    url: presign.public_url,
    file_path: presign.file_path,
    original_name: file.name,
    mime_type: file.type,
    size: file.size,
    duplicate: false
  };
}

/**
 * Batch upload files sequentially (can optimize to parallel with concurrency limit)
 */
export async function batchUpload(files, opts = {}, onProgress) {
  const results = [];
  let index = 0;
  for (const f of files) {
    // naive SHA256 omitted for speed; could add WebCrypto hashing if dedupe important client-side
    const img = await uploadViaPresign(f, opts);
    results.push(img);
    index++; if (onProgress) onProgress(index, files.length, img);
  }
  return results;
}
