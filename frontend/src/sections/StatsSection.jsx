import React, { useMemo } from 'react';
import { useQuery } from 'react-query';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { useTranslation } from '../hooks/useTranslation';
import { statsAPI } from '../lib/api';

const ACCENT_CLASSES = ['text-green-600', 'text-blue-600', 'text-purple-600', 'text-orange-600'];
const integerFormatter = new Intl.NumberFormat();
const compactFormatter = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });
const decimalFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const percentFormatter = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 });
const MESSAGE_COLORS = ['#38bdf8', '#f97316'];

const formatInteger = (value) => integerFormatter.format(Math.max(0, Math.round(value || 0)));
const formatCompact = (value) => compactFormatter.format(Math.max(0, value || 0));

const formatCarbon = (value, t) => {
  const numericValue = Number(value || 0);
  if (numericValue >= 1000) {
    return `${decimalFormatter.format(numericValue / 1000)} ${t('units.t')}`;
  }
  return `${decimalFormatter.format(numericValue)} ${t('units.kg')}`;
};

export default function StatsSection() {
  const { t } = useTranslation();

  const { data: summaryData, isLoading, isError } = useQuery(
    ['public-stats-summary'],
    async () => {
      const response = await statsAPI.getPublicSummary();
      return response.data?.data ?? {};
    },
    {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    }
  );

  const metrics = useMemo(() => {
    const summary = summaryData || {};
    return [
      {
        key: 'users',
        label: t('home.stats.users'),
        value: formatCompact(summary.total_users ?? 0),
        accent: ACCENT_CLASSES[0],
        detail: t('home.stats.newUsers30d', {
          value: formatInteger(summary.new_users_30d ?? 0),
        }),
      },
      {
        key: 'records',
        label: t('home.stats.activities'),
        value: formatCompact(summary.total_records ?? 0),
        accent: ACCENT_CLASSES[1],
        detail: t('home.stats.approvedRecords', {
          value: formatInteger(summary.approved_records ?? 0),
        }),
      },
      {
        key: 'carbon',
        label: t('home.stats.carbonSaved'),
        value: formatCarbon(summary.total_carbon_saved ?? 0, t),
        accent: ACCENT_CLASSES[2],
        detail: t('home.stats.carbonLast7Days', {
          value: formatCarbon(summary.carbon_last7 ?? 0, t),
        }),
      },
      {
        key: 'points',
        label: t('home.stats.rewards'),
        value: `${formatCompact(summary.total_points_awarded ?? 0)} ${t('units.points')}`,
        accent: ACCENT_CLASSES[3],
        detail: t('home.stats.transactionsLast7', {
          value: formatInteger(summary.transactions_last7 ?? 0),
        }),
      },
    ];
  }, [summaryData, t]);

  const messageSummary = useMemo(() => {
    const summary = summaryData?.messages ?? {};
    const totalRaw = Number(summary.total_messages ?? summaryData?.total_messages ?? 0);
    const unreadRaw = Number(summary.unread_messages ?? summaryData?.unread_messages ?? 0);
    let readRaw = Number(summary.read_messages ?? summaryData?.read_messages ?? (totalRaw - unreadRaw));

    const total = Number.isFinite(totalRaw) ? Math.max(0, totalRaw) : 0;
    const unread = Number.isFinite(unreadRaw) ? Math.max(0, unreadRaw) : 0;
    let read = Number.isFinite(readRaw) ? Math.max(0, readRaw) : Math.max(0, total - unread);
    if (read === 0 && total >= unread) {
      read = Math.max(0, total - unread);
    }
    const ratioRaw = Number(summary.unread_ratio ?? summaryData?.unread_ratio ?? (total > 0 ? unread / total : 0));
    const unreadRatio = Number.isFinite(ratioRaw) ? Math.max(0, ratioRaw) : 0;

    return {
      total,
      unread,
      read,
      unreadRatio,
    };
  }, [summaryData]);

  const messageChartData = useMemo(
    () => [
      { name: t('home.stats.messages.read', '已读'), value: messageSummary.read },
      { name: t('home.stats.messages.unread', '未读'), value: messageSummary.unread },
    ],
    [messageSummary.read, messageSummary.unread, t]
  );

  const unreadPercent = messageSummary.total > 0 ? messageSummary.unread / messageSummary.total : 0;
  const unreadRate = Math.min(Math.max(unreadPercent, 0), 1);
  const hasMessageData = messageSummary.total > 0 || messageSummary.unread > 0;

  const updatedAt = useMemo(() => {
    if (!summaryData?.generated_at) {
      return null;
    }
    const date = new Date(summaryData.generated_at);
    return Number.isNaN(date.getTime()) ? null : date;
  }, [summaryData?.generated_at]);

  const renderSkeleton = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={`skeleton-${index}`} className="text-center">
          <div className="mx-auto mb-3 h-8 w-24 animate-pulse rounded bg-gray-200" />
          <div className="mx-auto h-4 w-20 animate-pulse rounded bg-gray-200" />
        </div>
      ))}
    </div>
  );

  const renderError = () => (
    <div className="rounded-md border border-red-200 bg-red-50 p-6 text-center text-sm text-red-600">
      {t('home.stats.loadError')}
    </div>
  );

  const renderContent = () => (
    <div className="space-y-12">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
        {metrics.map((metric, index) => (
          <div key={metric.key} className="text-center">
            <div className={`text-3xl font-bold mb-2 ${metric.accent}`}>{metric.value}</div>
            <div className="text-gray-600 text-sm font-medium">{metric.label}</div>
            {metric.detail && (
              <div className="mt-1 text-xs text-gray-400">{metric.detail}</div>
            )}
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {t('home.stats.messages.title', '站内信概览')}
              </h3>
              <p className="text-sm text-gray-500">
                {t('home.stats.messages.subtitle', '展示最近站内信的阅读情况')}
              </p>
            </div>
            <div className="rounded-full bg-sky-100 px-4 py-2 text-sm font-semibold text-sky-600">
              {t('home.stats.messages.unreadLabelShort', '未读')} {formatInteger(messageSummary.unread)}
            </div>
          </div>
          <div className="mt-6 h-64">
            {hasMessageData ? (
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={messageChartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={4}
                    stroke="#fff"
                  >
                    {messageChartData.map((entry, index) => (
                      <Cell key={`message-segment-${entry.name}`} fill={MESSAGE_COLORS[index % MESSAGE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [formatInteger(value), name]}
                    contentStyle={{
                      borderRadius: '0.75rem',
                      border: '1px solid hsl(var(--border))',
                      backgroundColor: 'white',
                      boxShadow: '0 10px 25px -15px rgb(0 0 0 / 0.35)',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-gray-400">
                {t('home.stats.messages.empty', '暂时没有站内信数据')}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900">
            {t('home.stats.messages.detailsTitle', '详细数据')}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {t('home.stats.messages.detailsSubtitle', '统计截止当前时间的汇总情况')}
          </p>

          <div className="mt-6 space-y-3 text-sm text-gray-600">
            <div className="flex items-center justify-between">
              <span>{t('home.stats.messages.totalLabel', '总消息数')}</span>
              <span className="font-semibold text-gray-900">{formatInteger(messageSummary.total)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>{t('home.stats.messages.readLabel', '已读消息')}</span>
              <span className="font-semibold text-emerald-600">{formatInteger(messageSummary.read)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>{t('home.stats.messages.unreadLabel', '未读消息')}</span>
              <span className="font-semibold text-sky-600">{formatInteger(messageSummary.unread)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>{t('home.stats.messages.unreadRatioLabel', '未读率')}</span>
              <span className="font-semibold text-orange-500">
                {percentFormatter.format(unreadRate)}
              </span>
            </div>
          </div>

          <div className="mt-6 rounded-lg bg-slate-50 p-4 text-xs text-slate-600">
            {t('home.stats.messages.tip', '提示：管理员可以前往后台广播中心查看更详细的趋势图和按优先级的分布情况。')}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <section className="py-16 px-4 bg-white">
      <div className="max-w-7xl mx-auto">
        {isLoading && renderSkeleton()}
        {!isLoading && isError && renderError()}
        {!isLoading && !isError && renderContent()}
        {updatedAt && (
          <div className="mt-6 text-center text-xs text-gray-400">
            {t('home.stats.updatedAt', { time: updatedAt.toLocaleString() })}
          </div>
        )}
      </div>
    </section>
  );
}
