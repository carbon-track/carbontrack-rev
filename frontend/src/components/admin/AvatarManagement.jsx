import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { adminAPI } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { Loader2, RefreshCw, Edit, Trash2, RotateCcw, Star, Image as ImageIcon, Upload } from 'lucide-react';
import { uploadViaPresign } from '@/lib/r2Upload';
import R2Image from '@/components/common/R2Image';

const DEFAULT_FORM = {
  id: null,
  name: '',
  description: '',
  category: 'default',
  file_path: '',
  icon_url: '',
  icon_presigned_url: '',
  sort_order: 0,
  is_active: true,
  is_default: false,
};
const normalizeAvatar = (avatar = {}) => {
  if (!avatar || typeof avatar !== 'object') {
    return { ...DEFAULT_FORM };
  }
  const rawFilePath = typeof avatar.file_path === 'string' && avatar.file_path ? avatar.file_path : '';
  const normalizedPath = rawFilePath || (typeof avatar.icon_path === 'string' && avatar.icon_path ? `/${avatar.icon_path.replace(/^\/+, '')}` : '');
  const iconUrl = avatar.icon_url || avatar.url || avatar.image_url || '';
  return {
    ...avatar,
    file_path: normalizedPath,
    icon_path: avatar.icon_path || normalizedPath.replace(/^\/+/, ''),
    icon_url: iconUrl,
    icon_presigned_url: avatar.icon_presigned_url || '',
    image_url: avatar.image_url || iconUrl || '',
    url: avatar.url || iconUrl || '',
  };
};


export function AvatarManagement() {
  const { t } = useTranslation();
  const [avatars, setAvatars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [formValues, setFormValues] = useState(DEFAULT_FORM);
  const avatarInputRef = useRef(null);

  const fetchAvatars = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getAvatars({ include_inactive: true });
      if (response.data?.success) {
        const items = (response.data.data || []).map((item) => normalizeAvatar(item));
        setAvatars(items);
      }
    } catch (err) {
      toast.error(t('admin.avatars.loadFailed', '加载头像列表失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAvatars();
  }, []);

  const resetForm = () => {
    setFormValues({ ...DEFAULT_FORM });
  };

  const handleEdit = (avatar) => {
    const normalized = normalizeAvatar(avatar);
    setFormValues({
      id: normalized.id,
      name: normalized.name || '',
      description: normalized.description || '',
      category: normalized.category || 'default',
      file_path: normalized.file_path || '',
      icon_url: normalized.icon_url || normalized.image_url || '',
      icon_presigned_url: normalized.icon_presigned_url || '',
      sort_order: normalized.sort_order || 0,
      is_active: normalized.is_active === undefined ? true : !!normalized.is_active,
      is_default: !!normalized.is_default,
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleToggle = (field) => (checked) => {
    setFormValues((prev) => ({ ...prev, [field]: checked }));
  };

  const handleAvatarFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('admin.avatars.fileTooLarge', '文件大小不能超过5MB'));
      event.target.value = '';
      return;
    }
    setUploadingAvatar(true);
    const category = (formValues.category || 'default').trim() || 'default';
    try {
      const result = await uploadViaPresign(file, {
        directory: `avatars/${category}`,
        entityType: 'avatar',
        entityId: formValues.id || undefined,
      });
      const info = result?.data || result;
      setFormValues((prev) => ({
        ...prev,
        file_path: info.file_path || prev.file_path,
        icon_url: info.url || info.public_url || prev.icon_url,
        icon_presigned_url: info.presigned_url || prev.icon_presigned_url,
      }));
      toast.success(t('admin.avatars.uploadSuccess', '头像文件上传成功'));
    } catch (err) {
      toast.error(err?.message || t('admin.avatars.uploadFailed', '头像文件上传失败'));
    } finally {
      setUploadingAvatar(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formValues.file_path) {
      toast.error(t('admin.avatars.fileRequired', '请先上传头像文件'));
      return;
    }

    const payload = {
      name: formValues.name,
      description: formValues.description,
      category: formValues.category || 'default',
      file_path: formValues.file_path,
      sort_order: Number(formValues.sort_order) || 0,
      is_active: !!formValues.is_active,
      is_default: !!formValues.is_default,
    };

    try {
      setSaving(true);
      if (formValues.id) {
        await adminAPI.updateAvatar(formValues.id, payload);
        toast.success(t('admin.avatars.updateSuccess', '头像已更新'));
      } else {
        await adminAPI.createAvatar(payload);
        toast.success(t('admin.avatars.createSuccess', '头像已创建'));
      }
      resetForm();
      fetchAvatars();
    } catch (err) {
      toast.error(err.response?.data?.message || t('admin.avatars.saveFailed', '保存头像失败'));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (avatar) => {
    try {
      await adminAPI.updateAvatar(avatar.id, { is_active: !avatar.is_active });
      toast.success(!avatar.is_active
        ? t('admin.avatars.enabled', '头像已启用')
        : t('admin.avatars.disabled', '头像已停用'));
      fetchAvatars();
    } catch (err) {
      toast.error(err.response?.data?.message || t('admin.avatars.toggleFailed', '更新头像状态失败'));
    }
  };

  const setDefault = async (avatarId) => {
    try {
      await adminAPI.setDefaultAvatar(avatarId);
      toast.success(t('admin.avatars.setDefaultSuccess', '已设为默认头像'));
      fetchAvatars();
    } catch (err) {
      toast.error(err.response?.data?.message || t('admin.avatars.setDefaultFailed', '设置默认头像失败'));
    }
  };

  const deleteAvatar = async (avatarId) => {
    if (!window.confirm(t('admin.avatars.deleteConfirm', '确定要停用并移除该头像吗？'))) {
      return;
    }
    try {
      await adminAPI.deleteAvatar(avatarId);
      toast.success(t('admin.avatars.deleteSuccess', '头像已删除'));
      fetchAvatars();
    } catch (err) {
      toast.error(err.response?.data?.message || t('admin.avatars.deleteFailed', '删除头像失败'));
    }
  };

  const restoreAvatar = async (avatarId) => {
    try {
      await adminAPI.restoreAvatar(avatarId);
      toast.success(t('admin.avatars.restoreSuccess', '头像已恢复'));
      fetchAvatars();
    } catch (err) {
      toast.error(err.response?.data?.message || t('admin.avatars.restoreFailed', '恢复头像失败'));
    }
  };

  const formattedAvatars = useMemo(() => avatars || [], [avatars]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>{t('admin.avatars.listTitle', '头像库')}</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={fetchAvatars} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {t('common.refresh', '刷新')}
            </Button>
            <Button variant="secondary" onClick={resetForm}>
              {t('admin.avatars.newAvatar', '新建头像')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              {t('common.loading', '加载中...')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                      {t('admin.avatars.table.icon', '图标')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                      {t('admin.avatars.table.name', '名称')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                      {t('admin.avatars.table.category', '分类')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                      {t('admin.avatars.table.status', '状态')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                      {t('admin.avatars.table.sort', '排序')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                      {t('admin.avatars.table.updated', '更新时间')}
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider">
                      {t('common.actions', '操作')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {formattedAvatars.map((avatar) => (
                    <tr key={avatar.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="w-12 h-12 rounded-full overflow-hidden border bg-gray-100 flex items-center justify-center">
                          {avatar.file_path ? (
                            <R2Image
                              src={avatar.icon_presigned_url || avatar.icon_url}
                              filePath={!avatar.icon_presigned_url && !avatar.icon_url ? avatar.file_path : undefined}
                              alt={avatar.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{avatar.name}</div>
                        <div className="text-xs text-gray-500 truncate max-w-[180px]">{avatar.description}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{avatar.category || 'default'}</td>
                      <td className="px-4 py-3 space-x-2">
                        <Badge variant={avatar.is_active ? 'success' : 'secondary'}>
                          {avatar.is_active
                            ? t('admin.avatars.active', '启用')
                            : t('admin.avatars.inactive', '停用')}
                        </Badge>
                        {avatar.is_default && (
                          <Badge variant="outline">{t('admin.avatars.default', '默认')}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{avatar.sort_order}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {avatar.updated_at
                          ? format(new Date(avatar.updated_at), 'yyyy-MM-dd HH:mm')
                          : '--'}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(avatar)}>
                          <Edit className="h-4 w-4 mr-1" />
                          {t('common.edit', '编辑')}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => toggleActive(avatar)}>
                          {avatar.is_active
                            ? t('admin.avatars.disable', '停用')
                            : t('admin.avatars.enable', '启用')}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDefault(avatar.id)} disabled={avatar.is_default}>
                          <Star className="h-4 w-4 mr-1" />
                          {t('admin.avatars.setDefault', '设为默认')}
                        </Button>
                        {avatar.deleted_at ? (
                          <Button variant="ghost" size="sm" onClick={() => restoreAvatar(avatar.id)}>
                            <RotateCcw className="h-4 w-4 mr-1" />
                            {t('admin.avatars.restore', '恢复')}
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => deleteAvatar(avatar.id)}>
                            <Trash2 className="h-4 w-4 mr-1" />
                            {t('admin.avatars.delete', '删除')}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {formattedAvatars.length === 0 && !loading && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-500">
                        {t('admin.avatars.empty', '还没有头像数据')} 
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {formValues.id
              ? t('admin.avatars.editTitle', '编辑头像')
              : t('admin.avatars.createTitle', '创建新头像')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  {t('admin.avatars.fields.name', '显示名称')}
                </label>
                <Input
                  name="name"
                  value={formValues.name}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  {t('admin.avatars.fields.description', '描述')}
                </label>
                <Textarea
                  name="description"
                  value={formValues.description}
                  onChange={handleInputChange}
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  {t('admin.avatars.fields.category', '分类')}
                </label>
                <Input
                  name="category"
                  value={formValues.category}
                  onChange={handleInputChange}
                  placeholder="default"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  {t('admin.avatars.fields.icon', '上传头像图片')}
                </label>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarFileChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="flex items-center gap-2"
                >
                  {uploadingAvatar ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {t('admin.avatars.selectFile', '选择图片并上传')}
                </Button>
                <p className="text-xs text-gray-500">
                  {t('admin.avatars.uploadHint', '支持 JPG/PNG/WebP，单个不超过5MB。')}
                </p>
                {formValues.file_path && (
                  <div className="mt-2 w-20 h-20 rounded-full overflow-hidden border">
                    <R2Image
                      filePath={formValues.file_path}
                      alt={formValues.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  {t('admin.avatars.fields.sortOrder', '排序')}
                </label>
                <Input
                  type="number"
                  name="sort_order"
                  value={formValues.sort_order}
                  onChange={handleInputChange}
                />
              </div>
              <div className="flex items-center justify-between bg-gray-50 border rounded-md px-3 py-2">
                <span className="text-sm text-gray-700">{t('admin.avatars.fields.active', '是否启用')}</span>
                <Switch
                  checked={formValues.is_active}
                  onCheckedChange={handleToggle('is_active')}
                  aria-label={t('admin.avatars.fields.active', '是否启用')}
                />
              </div>
              <div className="flex items-center justify-between bg-gray-50 border rounded-md px-3 py-2">
                <span className="text-sm text-gray-700">{t('admin.avatars.fields.default', '设为默认')}</span>
                <Switch
                  checked={formValues.is_default}
                  onCheckedChange={handleToggle('is_default')}
                  aria-label={t('admin.avatars.fields.default', '设为默认')}
                />
              </div>

              <div className="flex items-center gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ImageIcon className="h-4 w-4 mr-2" />
                  )}
                  {formValues.id
                    ? t('admin.avatars.updateAction', '保存修改')
                    : t('admin.avatars.createAction', '创建头像')}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  {t('common.cancel', '取消')}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default AvatarManagement;
