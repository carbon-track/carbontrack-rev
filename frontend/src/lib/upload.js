import api from './api';
import axios from 'axios';

/**
 * 文件上传工具类
 */
export class FileUploader {
  constructor(options = {}) {
    this.maxFileSize = options.maxFileSize || 5 * 1024 * 1024; // 5MB
    this.allowedTypes = options.allowedTypes || [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp'
    ];
    this.allowedExtensions = options.allowedExtensions || [
      'jpg', 'jpeg', 'png', 'gif', 'webp'
    ];
  }

  /**
   * 计算文件 SHA256 (hex)
   */
  async computeSHA256(file) {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * 申请预签名（含去重）
   */
  async presignDirectUpload({ originalName, mimeType, directory='uploads', fileSize, sha256, entityType, entityId, expiresIn=600 }) {
    const payload = {
      original_name: originalName,
      mime_type: mimeType,
      directory,
      file_size: fileSize,
      sha256,
      entity_type: entityType,
      entity_id: entityId,
      expires_in: expiresIn
    };
    const { data } = await api.post('/files/presign', payload);
    if (!data.success) throw new Error(data.message || '获取预签名失败');
    return data.data; // 返回 data 内部结构
  }

  /**
   * 调用确认接口（包含引用计数递增）
   */
  async confirmDirectUpload({ filePath, originalName, sha256, entityType, entityId }) {
    const { data } = await api.post('/files/confirm', {
      file_path: filePath,
      original_name: originalName,
      sha256,
      entity_type: entityType,
      entity_id: entityId
    });
    if (!data.success) throw new Error(data.message || '上传确认失败');
    return data.data;
  }

  /**
   * 使用预签名 URL 直传单个文件（包含去重 + 确认）
   * 返回统一结构：{ success, data: { file_path, public_url, sha256, duplicate, ... } }
   */
  async directUploadSingle(file, options = {}) {
    // 1. 验证
    const validation = this.validateFile(file);
    if (!validation.isValid) {
      throw new Error(validation.errors.join('; '));
    }

    const sha256 = await this.computeSHA256(file);
    const presign = await this.presignDirectUpload({
      originalName: file.name,
      mimeType: file.type,
      directory: options.directory,
      fileSize: file.size,
      sha256,
      entityType: options.entityType,
      entityId: options.entityId
    });

    // 2. 若 duplicate 则直接 confirm (以递增引用) 并返回
    if (presign.duplicate) {
      const confirmed = await this.confirmDirectUpload({
        filePath: presign.file_path,
        originalName: file.name,
        sha256,
        entityType: options.entityType,
        entityId: options.entityId
      });
      return {
        success: true,
        data: {
          ...confirmed,
          file_path: presign.file_path,
          public_url: presign.public_url,
          duplicate: true,
          sha256
        }
      };
    }

    // 3. PUT 直传
    await axios.request({
      url: presign.url,
      method: presign.method || 'PUT',
      headers: presign.headers || { 'Content-Type': file.type },
      data: file,
      onUploadProgress: options.onProgress
    });

    // 4. 确认
    const confirmed = await this.confirmDirectUpload({
      filePath: presign.file_path,
      originalName: file.name,
      sha256,
      entityType: options.entityType,
      entityId: options.entityId
    });

    return {
      success: true,
      data: {
        ...confirmed,
        file_path: presign.file_path,
        public_url: presign.public_url,
        duplicate: false,
        sha256
      }
    };
  }

  /**
   * 多文件直传（串行，避免同时多大文件发压；可改并发）
   * 返回: { success, data: { results: [...], uploaded_count, duplicate_count } }
   */
  async directUploadMultiple(files, options = {}) {
    const results = [];
    let duplicateCount = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const perFileProgressWrapper = (evt) => {
        // 计算总体进度：已完成 + 当前文件进度
        if (options.onProgress && evt.total) {
          const singleRatio = evt.loaded / evt.total;
            const overall = ((i + singleRatio) / files.length) * 100;
            options.onProgress({ ...evt, loaded: overall, total: 100 });
        }
      };
      const res = await this.directUploadSingle(f, { ...options, onProgress: perFileProgressWrapper });
      if (res.data.duplicate) duplicateCount += 1;
      results.push(res.data);
    }
    return {
      success: true,
      data: {
        results,
        uploaded_count: results.length,
        duplicate_count: duplicateCount
      }
    };
  }

  /**
   * 验证文件
   */
  validateFile(file) {
    const errors = [];

    // 检查文件大小
    if (file.size > this.maxFileSize) {
      errors.push(`文件大小不能超过 ${this.formatFileSize(this.maxFileSize)}`);
    }

    // 检查文件类型
    if (!this.allowedTypes.includes(file.type)) {
      errors.push(`不支持的文件类型。支持的类型：${this.allowedTypes.join(', ')}`);
    }

    // 检查文件扩展名
    const extension = this.getFileExtension(file.name);
    if (!this.allowedExtensions.includes(extension)) {
      errors.push(`不支持的文件扩展名。支持的扩展名：${this.allowedExtensions.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 上传单个文件
   */
  async uploadFile(file, options = {}) {
    // 若显式要求 direct 模式
    if (options.mode === 'direct') {
      return this.directUploadSingle(file, options);
    }
    const validation = this.validateFile(file);
    if (!validation.isValid) {
      throw new Error(validation.errors.join('; '));
    }

    const formData = new FormData();
    formData.append('file', file);
    
    if (options.directory) {
      formData.append('directory', options.directory);
    }
    
    if (options.entityType) {
      formData.append('entity_type', options.entityType);
    }
    
    if (options.entityId) {
      formData.append('entity_id', options.entityId.toString());
    }

    try {
      const response = await api.post('/files/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: options.onProgress
      });

      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || '文件上传失败');
    }
  }

  /**
   * 上传多个文件
   */
  async uploadMultipleFiles(files, options = {}) {
    if (options.mode === 'direct') {
      return this.directUploadMultiple(files, options);
    }
    // 验证所有文件
    const validationResults = files.map(file => ({
      file,
      validation: this.validateFile(file)
    }));

    const invalidFiles = validationResults.filter(result => !result.validation.isValid);
    if (invalidFiles.length > 0) {
      const errors = invalidFiles.map(result => 
        `${result.file.name}: ${result.validation.errors.join('; ')}`
      );
      throw new Error('文件验证失败:\n' + errors.join('\n'));
    }

    const formData = new FormData();
    files.forEach(file => {
      formData.append('files[]', file);
    });
    
    if (options.directory) {
      formData.append('directory', options.directory);
    }
    
    if (options.entityType) {
      formData.append('entity_type', options.entityType);
    }
    
    if (options.entityId) {
      formData.append('entity_id', options.entityId.toString());
    }

    try {
      const response = await api.post('/files/upload-multiple', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: options.onProgress
      });

      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || '文件上传失败');
    }
  }

  /**
   * 删除文件
   */
  async deleteFile(filePath) {
    try {
      const encodedPath = encodeURIComponent(filePath);
      const response = await api.delete(`/files/${encodedPath}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || '文件删除失败');
    }
  }

  /**
   * 获取文件信息
   */
  async getFileInfo(filePath) {
    try {
      const encodedPath = encodeURIComponent(filePath);
      const response = await api.get(`/files/${encodedPath}/info`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || '获取文件信息失败');
    }
  }

  /**
   * 生成预签名URL
   */
  async generatePresignedUrl(filePath, expiresIn = 3600) {
    try {
      const encodedPath = encodeURIComponent(filePath);
      const response = await api.get(`/files/${encodedPath}/presigned-url`, {
        params: { expires_in: expiresIn }
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || '生成预签名URL失败');
    }
  }

  /**
   * 获取文件扩展名
   */
  getFileExtension(filename) {
    return filename.split('.').pop().toLowerCase();
  }

  /**
   * 格式化文件大小
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * 检查是否为图片文件
   */
  isImageFile(file) {
    return file.type.startsWith('image/');
  }

  /**
   * 创建图片预览URL
   */
  createPreviewUrl(file) {
    if (!this.isImageFile(file)) {
      return null;
    }
    return URL.createObjectURL(file);
  }

  /**
   * 释放预览URL
   */
  revokePreviewUrl(url) {
    if (url) {
      URL.revokeObjectURL(url);
    }
  }

  /**
   * 压缩图片（可选功能）
   */
  async compressImage(file, options = {}) {
    const {
      maxWidth = 1920,
      maxHeight = 1080,
      quality = 0.8,
      outputFormat = 'image/jpeg'
    } = options;

    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // 计算新的尺寸
        let { width, height } = img;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }

        // 设置画布尺寸
        canvas.width = width;
        canvas.height = height;

        // 绘制图片
        ctx.drawImage(img, 0, 0, width, height);

        // 转换为Blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              // 创建新的File对象
              const compressedFile = new File([blob], file.name, {
                type: outputFormat,
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              reject(new Error('图片压缩失败'));
            }
          },
          outputFormat,
          quality
        );
      };

      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = URL.createObjectURL(file);
    });
  }
}

// 创建默认实例
export const fileUploader = new FileUploader();

// 便捷函数
export const uploadFile = (file, options) => fileUploader.uploadFile(file, options);
export const uploadMultipleFiles = (files, options) => fileUploader.uploadMultipleFiles(files, options);
export const deleteFile = (filePath) => fileUploader.deleteFile(filePath);
export const getFileInfo = (filePath) => fileUploader.getFileInfo(filePath);
export const generatePresignedUrl = (filePath, expiresIn) => fileUploader.generatePresignedUrl(filePath, expiresIn);

// 管理员功能
export const adminAPI = {
  // 获取存储统计
  async getStorageStats() {
    try {
      const response = await api.get('/admin/files/stats');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || '获取存储统计失败');
    }
  },

  // 清理过期文件
  async cleanupExpiredFiles(directory = 'temp', daysOld = 7) {
    try {
      const response = await api.post('/admin/files/cleanup', {
        directory,
        days_old: daysOld
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || '清理过期文件失败');
    }
  }
};

export default fileUploader;

