import React, { useState } from 'react';
import { useMutation } from 'react-query';
import { useTranslation } from '../../hooks/useTranslation';
import { adminAPI } from '../../lib/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Alert, AlertTitle, AlertDescription } from '../ui/Alert';
import { toast } from 'react-hot-toast';

export function BroadcastCenter() {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    title: '',
    content: '',
    priority: 'normal',
    scope: 'all', // all | custom
    target_users_text: '' // comma-separated ids
  });
  const [preview, setPreview] = useState(null);

  const broadcastMutation = useMutation(
    (payload) => adminAPI.broadcastMessage(payload),
    {
      onSuccess: (res) => {
        const sent = res?.data?.sent_count ?? 0;
        toast.success(t('admin.broadcast.sendSuccess', { count: sent }));
        setPreview(null);
        setForm({ title: '', content: '', priority: 'normal', scope: 'all', target_users_text: '' });
      },
      onError: () => {
        toast.error(t('admin.broadcast.sendFailed'));
      }
    }
  );

  const onChange = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const buildPayload = () => {
    const payload = {
      title: form.title.trim(),
      content: form.content.trim(),
      priority: form.priority,
    };
    if (form.scope === 'custom') {
      const ids = form.target_users_text
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(x => Number(x))
        .filter(n => Number.isFinite(n) && n > 0);
      if (ids.length > 0) payload.target_users = ids;
    }
    return payload;
  };

  const handlePreview = () => {
    const payload = buildPayload();
    if (!payload.title || !payload.content) {
      toast.error(t('validation.required'));
      return;
    }
    setPreview({ ...payload });
  };

  const handleSend = () => {
    const payload = buildPayload();
    if (!payload.title || !payload.content) {
      toast.error(t('validation.required'));
      return;
    }
    broadcastMutation.mutate(payload);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">{t('admin.broadcast.title')}</h2>
      <p className="text-muted-foreground">{t('admin.broadcast.description')}</p>

      <div className="bg-white rounded-lg shadow-sm border p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin.broadcast.form.title')}</label>
          <Input value={form.title} onChange={(e) => onChange('title', e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin.broadcast.form.content')}</label>
          <textarea
            value={form.content}
            onChange={(e) => onChange('content', e.target.value)}
            className="w-full border border-gray-300 rounded-md p-2 min-h-[120px]"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin.broadcast.form.priority')}</label>
            <select
              value={form.priority}
              onChange={(e) => onChange('priority', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="low">{t('messages.priority.low')}</option>
              <option value="normal">{t('messages.priority.normal')}</option>
              <option value="high">{t('messages.priority.high')}</option>
              <option value="urgent">{t('messages.priority.urgent')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin.broadcast.form.scope')}</label>
            <select
              value={form.scope}
              onChange={(e) => onChange('scope', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="all">{t('admin.broadcast.scope.all')}</option>
              <option value="custom">{t('admin.broadcast.scope.custom')}</option>
            </select>
          </div>
          {form.scope === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin.broadcast.form.targetUsers')}</label>
              <Input
                placeholder={t('admin.broadcast.form.targetUsersPlaceholder')}
                value={form.target_users_text}
                onChange={(e) => onChange('target_users_text', e.target.value)}
              />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={handlePreview}>{t('admin.broadcast.preview')}</Button>
          <Button type="button" onClick={handleSend} disabled={broadcastMutation.isLoading}>
            {broadcastMutation.isLoading ? t('common.sending') : t('admin.broadcast.send')}
          </Button>
        </div>
      </div>

      {preview && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold mb-2">{t('admin.broadcast.previewPanel')}</h3>
          <div className="space-y-2">
            <div>
              <span className="text-sm text-gray-500 mr-2">{t('admin.broadcast.form.title')}:</span>
              <span className="font-medium">{preview.title}</span>
            </div>
            <div>
              <span className="text-sm text-gray-500 mr-2">{t('admin.broadcast.form.priority')}:</span>
              <span className="font-medium">{preview.priority}</span>
            </div>
            <div>
              <span className="text-sm text-gray-500 mr-2">{t('admin.broadcast.form.content')}:</span>
              <p className="mt-1 whitespace-pre-wrap">{preview.content}</p>
            </div>
          </div>
          <Alert className="mt-4">
            <AlertTitle>{t('admin.broadcast.noticeTitle')}</AlertTitle>
            <AlertDescription>{t('admin.broadcast.noticeDesc')}</AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
}

export default BroadcastCenter;
