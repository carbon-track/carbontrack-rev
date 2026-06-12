import apiClient from './client';

const unwrap = (response) => response.data?.data ?? response.data;

const fileNameFromUri = (uri) => String(uri || '').split('/').pop() || `upload-${Date.now()}.jpg`;

export const filesApi = {
  uploadImage: async ({
    directory = 'support-tickets',
    entityId,
    entityType,
    image,
  }) => {
    const formData = new FormData();
    formData.append('file', {
      uri: image.uri,
      name: image.fileName || fileNameFromUri(image.uri),
      type: image.mimeType || 'image/jpeg',
    });
    formData.append('directory', directory);
    if (entityType) {
      formData.append('entity_type', entityType);
    }
    if (entityId) {
      formData.append('entity_id', String(entityId));
    }

    return unwrap(await apiClient.post('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }));
  },
};
