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
import { Loader2, RefreshCw, Edit, Sparkles, Trash2, Award, Upload } from 'lucide-react';
import { uploadViaPresign } from '@/lib/r2Upload';
import R2Image from '@/components/common/R2Image';

const DEFAULT_FORM = {
  id: null,
  name_zh: '',
  name_en: '',
  description_zh: '',
  description_en: '',
  icon_path: '',
  icon_thumbnail_path: '',
  sort_order: 0,
  is_active: true,
  auto_grant_enabled: false,
  auto_grant_criteria: '',
  message_title_zh: '',
  message_title_en: '',
  message_body_zh: '',
  message_body_en: '',
};

export function BadgeManagement() {
  const { t } = useTranslation();
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [formValues, setFormValues] = useState(DEFAULT_FORM);
  const iconInputRef = useRef(null);

  const fetchBadges = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getBadges();
      if (response.data?.success) {
        setBadges(response.data.data || []);
      }
    } catch (err) {
      toast.error(t('admin.badges.loadFailed', '加载徽章列表失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBadges();
  }, []);

  const resetForm = () => {
    setFormValues(DEFAULT_FORM);
  };

  const handleEdit = (badge) => {
    setFormValues({
      ...DEFAULT_FORM,
      ...badge,
      auto_grant_criteria: badge.auto_grant_criteria
        ? JSON.stringify(badge.auto_grant_criteria, null, 2)
        : '',
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleToggle = (field) => (checked) => {
    setFormValues((prev) => ({ ...prev, [field]: checked }));
  };

  const handleIconFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('admin.badges.fileTooLarge', '文件大小不能超过5MB'));
      event.target.value = '';
      return;
    }
    setUploadingIcon(true);
    try {
      const result = await uploadViaPresign(file, {
        directory: 'badges',
        entityType: 'badge',
        entityId: formValues.id || undefined,
      });
      const info = result?.data || result;
      setFormValues((prev) => ({
        ...prev,
        icon_path: info.file_path || prev.icon_path,
        icon_thumbnail_path: info.thumbnail_path || prev.icon_thumbnail_path,
      }));
      toast.success(t('admin.badges.uploadSuccess', '徽章图标上传成功'));
    } catch (err) {
      toast.error(err?.message || t('admin.badges.uploadFailed', '徽章图标上传失败'));
    } finally {
      setUploadingIcon(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name_zh: formValues.name_zh,
      name_en: formValues.name_en,
      description_zh: formValues.description_zh,
      description_en: formValues.description_en,
      icon_path: formValues.icon_path,
      icon_thumbnail_path: formValues.icon_thumbnail_path,
      sort_order: Number(formValues.sort_order) || 0,
      is_active: !!formValues.is_active,
      auto_grant_enabled: !!formValues.auto_grant_enabled,
      message_title_zh: formValues.message_title_zh,
      message_title_en: formValues.message_title_en,
      message_body_zh: formValues.message_body_zh,
      message_body_en: formValues.message_body_en,
    };

    if (formValues.auto_grant_criteria) {
      try {
        payload.auto_grant_criteria = JSON.parse(formValues.auto_grant_criteria);
      } catch (err) {
        toast.error(t('admin.badges.criteriaParseFailed', '自动授予规则 JSON 解析失败'));
        return;
      }
    } else {
      payload.auto_grant_criteria = null;
    }

    try {
      setSaving(true);
      if (formValues.id) {
        await adminAPI.updateBadge(formValues.id, payload);
        toast.success(t('admin.badges.updateSuccess', '徽章已更新'));
      } else {
        await adminAPI.createBadge(payload);
        toast.success(t('admin.badges.createSuccess', '徽章已创建'));
      }
      resetForm();
      fetchBadges();
    } catch (err) {
      toast.error(err.response?.data?.message || t('admin.badges.saveFailed', '保存徽章失败'));
    } finally {
      setSaving(false);
    }
  };

  const handleAward = async (badgeId) => {
    const input = window.prompt(t('admin.badges.awardPrompt', '请输入要授予的用户 ID'));
    if (!input) return;
    const userId = Number(input);
    if (!Number.isInteger(userId) || userId <= 0) {
      toast.error(t('admin.badges.invalidUserId', '用户 ID 无效'));
      return;
    }

    try {
      await adminAPI.awardBadge(badgeId, { user_id: userId });
      toast.success(t('admin.badges.awardSuccess', '徽章已授予指定用户'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('admin.badges.awardFailed', '授予徽章失败'));
    }
  };

  const handleRevoke = async (badgeId) => {
    const input = window.prompt(t('admin.badges.revokePrompt', '请输入要收回的用户 ID'));
    if (!input) return;
    const userId = Number(input);
    if (!Number.isInteger(userId) || userId <= 0) {
      toast.error(t('admin.badges.invalidUserId', '用户 ID 无效'));
      return;
    }

    try {
      await adminAPI.revokeBadge(badgeId, { user_id: userId });
      toast.success(t('admin.badges.revokeSuccess', '徽章已收回'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('admin.badges.revokeFailed', '收回徽章失败'));
    }
  };

  const handleTriggerAuto = async () => {
    try {
      setTriggering(true);
      const response = await adminAPI.triggerBadgeAuto();
      const summary = response.data?.data;
      toast.success(
        t('admin.badges.autoTriggered', '已触发自动授予流程') +
          (summary ? ` (${summary.awarded || 0} / ${summary.users || 0})` : '')
      );
    } catch (err) {
      toast.error(err.response?.data?.message || t('admin.badges.autoTriggerFailed', '触发自动授予失败'));
    } finally {
      setTriggering(false);
      fetchBadges();
    }
  };

  const formattedBadges = useMemo(() => badges || [], [badges]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('admin.badges.listTitle', '成就徽章列表')}</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={fetchBadges} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {t('common.refresh', '刷新')}
            </Button>
            <Button variant="outline" onClick={handleTriggerAuto} disabled={triggering}>
              {triggering ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              {t('admin.badges.triggerAuto', '触发自动授予')}
            </Button>
            <Button onClick={resetForm} variant="secondary">
              {t('admin.badges.newBadge', '新建徽章')}
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
                      {t('admin.badges.table.icon', '图标')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                      {t('admin.badges.table.name', '名称')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                      {t('admin.badges.table.status', '状态')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                      {t('admin.badges.table.auto', '自动授予')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                      {t('admin.badges.table.sort', '排序')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                      {t('admin.badges.table.updated', '更新时间')}
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider">
                      {t('common.actions', '操作')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {formattedBadges.map((badge) => (
                    <tr key={badge.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="w-12 h-12 rounded-full bg-gray-100 border overflow-hidden flex items-center justify-center">
                          {badge.icon_path ? (
                            <R2Image
                              src={badge.icon_presigned_url || badge.icon_url}
                              filePath={!badge.icon_presigned_url && !badge.icon_url ? badge.icon_path : undefined}
                              alt={badge.name_zh || badge.name_en}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Award className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{badge.name_zh || badge.name_en}</div>
                        <div className="text-xs text-gray-500">{badge.name_en}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={badge.is_active ? 'success' : 'secondary'}>
                          {badge.is_active
                            ? t('admin.badges.active', '启用')
                            : t('admin.badges.inactive', '停用')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={badge.auto_grant_enabled ? 'outline' : 'secondary'}>
                          {badge.auto_grant_enabled
                            ? t('admin.badges.autoEnabled', '已开启')
                            : t('admin.badges.autoDisabled', '未开启')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{badge.sort_order}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {badge.updated_at
                          ? format(new Date(badge.updated_at), 'yyyy-MM-dd HH:mm')
                          : '--'}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(badge)}>
                          <Edit className="h-4 w-4 mr-1" />
                          {t('common.edit', '编辑')}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleAward(badge.id)}>
                          <Sparkles className="h-4 w-4 mr-1" />
                          {t('admin.badges.award', '授予')}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleRevoke(badge.id)}>
                          <Trash2 className="h-4 w-4 mr-1" />
                          {t('admin.badges.revoke', '收回')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {formattedBadges.length === 0 && !loading && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-500">
                        {t('admin.badges.empty', '还没有创建任何徽章')}
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
              ? t('admin.badges.editTitle', '编辑徽章')
              : t('admin.badges.createTitle', '创建新徽章')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  {t('admin.badges.fields.nameZh', '中文名称')}
                </label>
                <Input
                  name="name_zh"
                  value={formValues.name_zh}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  {t('admin.badges.fields.nameEn', '英文名称')}
                </label>
                <Input
                  name="name_en"
                  value={formValues.name_en}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  {t('admin.badges.fields.descZh', '中文描述')}
                </label>
                <Textarea
                  name="description_zh"
                  value={formValues.description_zh}
                  onChange={handleInputChange}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  {t('admin.badges.fields.descEn', '英文描述')}
                </label>
                <Textarea
                  name="description_en"
                  value={formValues.description_en}
                  onChange={handleInputChange}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  {t('admin.badges.fields.icon', '徽章图标')}
                </label>
                <input
                  ref={iconInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleIconFileChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => iconInputRef.current?.click()}
                  disabled={uploadingIcon}
                  className="flex items-center gap-2"
                >
                  {uploadingIcon ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {t('admin.badges.selectIcon', '选择图标并上传')}
                </Button>
                <p className="text-xs text-gray-500">
                  {t('admin.badges.uploadHint', '支持 JPG/PNG/WebP，单个不超过5MB。')}
                </p>
                {(formValues.icon_path || formValues.icon_thumbnail_path) && (
                  <div className="mt-2 w-20 h-20 rounded-full overflow-hidden border">
                    <R2Image
                      filePath={formValues.icon_path || formValues.icon_thumbnail_path}
                      alt={formValues.name_zh || formValues.name_en}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    {t('admin.badges.fields.sortOrder', '排序')}
                  </label>
                  <Input
                    type="number"
                    name="sort_order"
                    value={formValues.sort_order}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="flex items-center justify-between bg-gray-50 border rounded-md px-3 py-2">
                  <span className="text-sm text-gray-700">{t('admin.badges.fields.active', '是否启用')}</span>
                  <Switch
                    checked={formValues.is_active}
                    onCheckedChange={handleToggle('is_active')}
                    aria-label={t('admin.badges.fields.active', '是否启用')}
                  />
                </div>
                <div className="flex items-center justify-between bg-gray-50 border rounded-md px-3 py-2">
                  <span className="text-sm text-gray-700">{t('admin.badges.fields.autoGrant', '自动授予')}</span>
                  <Switch
                    checked={formValues.auto_grant_enabled}
                    onCheckedChange={handleToggle('auto_grant_enabled')}
                    aria-label={t('admin.badges.fields.autoGrant', '自动授予')}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  {t('admin.badges.fields.autoCriteria', '自动授予规则 (JSON)')}
                </label>
                <Textarea
                  name="auto_grant_criteria"
                  value={formValues.auto_grant_criteria}
                  onChange={handleInputChange}
                  rows={6}
                  placeholder='{"rules":[{"metric":"total_carbon_saved","operator":">=","value":100}],"all_required":true}'
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  {t('admin.badges.fields.messageTitleZh', '系统信件标题（中文）')}
                </label>
                <Input
                  name="message_title_zh"
                  value={formValues.message_title_zh}
                  onChange={handleInputChange}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  {t('admin.badges.fields.messageTitleEn', '系统信件标题（英文）')}
                </label>
                <Input
                  name="message_title_en"
                  value={formValues.message_title_en}
                  onChange={handleInputChange}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  {t('admin.badges.fields.messageBodyZh', '系统信件内容（中文）')}
                </label>
                <Textarea
                  name="message_body_zh"
                  value={formValues.message_body_zh}
                  onChange={handleInputChange}
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  {t('admin.badges.fields.messageBodyEn', '系统信件内容（英文）')}
                </label>
                <Textarea
                  name="message_body_en"
                  value={formValues.message_body_en}
                  onChange={handleInputChange}
                  rows={4}
                />
              </div>

              <div className="flex items-center gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  {formValues.id
                    ? t('admin.badges.updateAction', '保存修改')
                    : t('admin.badges.createAction', '创建徽章')}
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

export default BadgeManagement;
