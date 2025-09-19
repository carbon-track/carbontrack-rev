import React, { useMemo } from 'react';
import { useTranslation } from '../../hooks/useTranslation';

const renderField = (label, value) => (
  <div className="space-y-1" key={label}>
    <p className="text-sm font-medium text-gray-700">{label}</p>
    <div className="rounded-md border border-dashed border-gray-200 bg-muted/40 px-3 py-2 text-sm text-gray-900">
      {value ?? '—'}
    </div>
  </div>
);

export function ProfileForm({ user }) {
  const { t } = useTranslation();

  const formattedUpdatedAt = useMemo(() => {
    if (!user?.updated_at) return '—';
    const dateValue = new Date(user.updated_at);
    if (Number.isNaN(dateValue.getTime())) {
      return user.updated_at;
    }
    return dateValue.toLocaleString();
  }, [user?.updated_at]);

  const summaryItems = [
    {
      label: t('profile.userId', '用户ID'),
      value: user?.id ?? '—',
    },
    {
      label: t('profile.uuid', 'UUID'),
      value: user?.uuid || '—',
    },
    {
      label: t('profile.points', '积分'),
      value: user?.points ?? 0,
    },
    {
      label: t('profile.lastUpdated', '最近更新'),
      value: formattedUpdatedAt,
    },
  ];

  const detailFields = [
    {
      label: t('profile.username'),
      value: user?.username || '—',
    },
    {
      label: t('profile.email'),
      value: user?.email || '—',
    },
    {
      label: t('profile.school'),
      value: user?.school_name || user?.school || '—',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg border bg-muted/40 p-4">
        {summaryItems.map((item) => (
          <div className="min-w-0" key={item.label}>
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="text-sm font-medium break-words">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {detailFields.map(({ label, value }) => renderField(label, value))}
      </div>

      <p className="text-xs text-muted-foreground">
        {t('profile.editInfoHint', '如需调整学校等信息，请联系管理员或使用入门流程。')}
      </p>
    </div>
  );
}

