import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { adminAPI } from '../../lib/api';
import { useTranslation } from '../../hooks/useTranslation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/Alert';
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  LineChart as LineChartIcon,
  Clock,
  Users,
  Leaf,
  Activity,
  Package,
  MessageSquare,
  TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Line,
  Area,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const safeNumber = (value) => {
  if (value === null || value === undefined) {
    return 0;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const safeDivide = (numerator, denominator) => {
  if (!denominator || Number.isNaN(denominator)) {
    return 0;
  }
  return numerator / denominator;
};

export default function AdminDashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const refreshIntervalMs = 30000;

  const statsQuery = useQuery(
    ['adminStats'],
    async () => {
      const res = await adminAPI.getStats();
      return res.data?.data || {};
    },
    {
      staleTime: 15000,
      refetchOnWindowFocus: false,
      refetchInterval: autoRefresh ? refreshIntervalMs : false,
      keepPreviousData: true,
      onSuccess: (data) => {
        if (data?.generated_at) {
          const generated = new Date(data.generated_at);
          if (!Number.isNaN(generated.getTime())) {
            setLastUpdated(generated);
            return;
          }
        }
        setLastUpdated(new Date());
      },
    }
  );

  const statsData = statsQuery.data ?? {};
  const isLoading = statsQuery.isLoading;
  const isError = statsQuery.isError;
  const error = statsQuery.error;
  const refetch = statsQuery.refetch;
  const isFetching = statsQuery.isFetching;

  const integerFormatter = useMemo(() => new Intl.NumberFormat(), []);
  const decimalFormatter = useMemo(() => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }), []);
  const percentFormatter = useMemo(() => new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 }), []);
  const shortDateFormatter = useMemo(() => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }), []);
  const longDateFormatter = useMemo(() => new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }), []);

  const formatDateLabel = (value, formatter) => {
    if (!value) {
      return value;
    }
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return formatter.format(date);
  };
  const formatDateTime = (value) => {
    if (!value) {
      return '--';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString();
  };


  const normalizedStats = useMemo(() => {
    const base = statsData ?? {};
    const users = {
      total: safeNumber(base.users?.total_users),
      active: safeNumber(base.users?.active_users),
      inactive: safeNumber(base.users?.inactive_users),
      new30d: safeNumber(base.users?.new_users_30d),
      activeRatio: Number(base.users?.active_ratio ?? safeDivide(safeNumber(base.users?.active_users), safeNumber(base.users?.total_users))),
      newUsersRatio: Number(base.users?.new_users_ratio ?? safeDivide(safeNumber(base.users?.new_users_30d), safeNumber(base.users?.total_users))),
    };

    const transactions = {
      total: safeNumber(base.transactions?.total_transactions),
      pending: safeNumber(base.transactions?.pending_transactions),
      approved: safeNumber(base.transactions?.approved_transactions),
      rejected: safeNumber(base.transactions?.rejected_transactions),
      totalPointsAwarded: Number(base.transactions?.total_points_awarded ?? 0),
      totalCarbonSaved: Number(base.transactions?.total_carbon_saved ?? base.carbon?.total_carbon_saved ?? 0),
      approvalRate: Number(base.transactions?.approval_rate ?? safeDivide(safeNumber(base.transactions?.approved_transactions), safeNumber(base.transactions?.total_transactions))),
      pendingRatio: Number(base.transactions?.pending_ratio ?? safeDivide(safeNumber(base.transactions?.pending_transactions), safeNumber(base.transactions?.total_transactions))),
      avgPointsPerTransaction: Number(base.transactions?.avg_points_per_transaction ?? 0),
      last7Transactions: safeNumber(base.transactions?.last7_transactions),
      last7PointsAwarded: Number(base.transactions?.last7_points_awarded ?? 0),
    };

    const exchanges = {
      total: safeNumber(base.exchanges?.total_exchanges),
      pending: safeNumber(base.exchanges?.pending_exchanges),
      completed: safeNumber(base.exchanges?.completed_exchanges),
      other: safeNumber(base.exchanges?.other_exchanges),
      totalPointsSpent: Number(base.exchanges?.total_points_spent ?? 0),
      completionRate: Number(base.exchanges?.completion_rate ?? safeDivide(safeNumber(base.exchanges?.completed_exchanges), safeNumber(base.exchanges?.total_exchanges))),
    };

    const messages = {
      total: safeNumber(base.messages?.total_messages),
      unread: safeNumber(base.messages?.unread_messages),
      read: safeNumber(base.messages?.read_messages ?? (safeNumber(base.messages?.total_messages) - safeNumber(base.messages?.unread_messages))),
      unreadRatio: Number(base.messages?.unread_ratio ?? safeDivide(safeNumber(base.messages?.unread_messages), safeNumber(base.messages?.total_messages))),
    };

    const activities = {
      totalRecords: safeNumber(base.activities?.total_records),
      approvedRecords: safeNumber(base.activities?.approved_records),
      pendingRecords: safeNumber(base.activities?.pending_records),
      rejectedRecords: safeNumber(base.activities?.rejected_records),
      catalogTotal: safeNumber(base.activities?.total_activities),
      catalogActive: safeNumber(base.activities?.active_activities),
      catalogInactive: safeNumber(base.activities?.inactive_activities ?? (safeNumber(base.activities?.total_activities) - safeNumber(base.activities?.active_activities))),
    };

    const carbon = {
      totalRecords: safeNumber(base.carbon?.total_records),
      pendingRecords: safeNumber(base.carbon?.pending_records),
      approvedRecords: safeNumber(base.carbon?.approved_records),
      rejectedRecords: safeNumber(base.carbon?.rejected_records),
      totalCarbonSaved: Number(base.carbon?.total_carbon_saved ?? 0),
      totalPointsEarned: Number(base.carbon?.total_points_earned ?? 0),
      last7CarbonSaved: Number(base.carbon?.last7_carbon_saved ?? 0),
      last7PointsEarned: Number(base.carbon?.last7_points_earned ?? 0),
      averageCarbonPerRecord: Number(base.carbon?.average_carbon_per_record ?? 0),
      averageDailyCarbon: Number(base.carbon?.average_daily_carbon ?? 0),
      approvalRate: Number(base.carbon?.approval_rate ?? safeDivide(safeNumber(base.carbon?.approved_records), safeNumber(base.carbon?.total_records))),
    };

    const trends = Array.isArray(base.trends)
      ? base.trends.map((item) => ({
          date: item?.date ?? '',
          transactions: safeNumber(item?.transactions),
          carbon_saved: safeNumber(item?.carbon_saved),
          points_awarded: Number(item?.points_awarded ?? 0),
          approved_records: safeNumber(item?.approved_records),
        }))
      : [];

    const trendSummary = {
      carbonLast7: Number(base.trend_summary?.carbon_last7 ?? 0),
      carbonPrev7: Number(base.trend_summary?.carbon_prev7 ?? 0),
      carbonDelta: Number(base.trend_summary?.carbon_delta ?? 0),
      carbonDeltaRate: Number(base.trend_summary?.carbon_delta_rate ?? 0),
      transactionsLast7: safeNumber(base.trend_summary?.transactions_last7),
      pointsLast7: Number(base.trend_summary?.points_last7 ?? 0),
      averageDailyCarbon30d: Number(base.trend_summary?.average_daily_carbon_30d ?? 0),
    };

    const recent = {
      pendingTransactions: Array.isArray(base.recent?.pending_transactions) ? base.recent.pending_transactions : [],
      pendingCarbonRecords: Array.isArray(base.recent?.pending_carbon_records) ? base.recent.pending_carbon_records : [],
      latestUsers: Array.isArray(base.recent?.latest_users) ? base.recent.latest_users : [],
    };

    return { users, transactions, exchanges, messages, activities, carbon, trends, trendSummary, recent };
  }, [statsData]);


  const trendChartData = useMemo(() => {
    const entries = normalizedStats.trends;
    if (!entries.length) {
      return [];
    }
    return entries.map((entry, index, array) => {
      const start = Math.max(0, index - 6);
      const window = array.slice(start, index + 1);
      const carbonAvg = safeDivide(window.reduce((sum, item) => sum + item.carbon_saved, 0), window.length || 1);
      const transactionAvg = safeDivide(window.reduce((sum, item) => sum + item.transactions, 0), window.length || 1);
      return {
        ...entry,
        carbon_avg: carbonAvg,
        transactions_avg: transactionAvg,
      };
    });
  }, [normalizedStats.trends]);

  const trendSummary = normalizedStats.trendSummary;
  const carbonStats = normalizedStats.carbon;
  const recent = normalizedStats.recent;


  const transactionStatusData = useMemo(() => {
    const { pending, approved, rejected, total } = normalizedStats.transactions;
    const other = Math.max(total - (pending + approved + rejected), 0);
    const data = [
      { label: t('admin.dashboard.statusPending'), value: pending },
      { label: t('admin.dashboard.statusApproved'), value: approved },
      { label: t('admin.dashboard.statusRejected'), value: rejected },
    ];
    if (other > 0) {
      data.push({ label: t('admin.dashboard.statusOther'), value: other });
    }
    return data;
  }, [normalizedStats.transactions, t]);

  const exchangeStatusData = useMemo(() => {
    const { pending, completed, total } = normalizedStats.exchanges;
    const other = Math.max(total - (pending + completed), 0);
    const data = [
      { label: t('admin.dashboard.statusPending'), value: pending },
      { label: t('admin.dashboard.statusCompleted'), value: completed },
    ];
    if (other > 0) {
      data.push({ label: t('admin.dashboard.statusOther'), value: other });
    }
    return data;
  }, [normalizedStats.exchanges, t]);

  const userStatusData = useMemo(() => {
    const { active, inactive, total } = normalizedStats.users;
    const other = Math.max(total - (active + inactive), 0);
    const data = [
      { label: t('admin.dashboard.statusActive'), value: active },
      { label: t('admin.dashboard.statusInactive'), value: inactive },
    ];
    if (other > 0) {
      data.push({ label: t('admin.dashboard.statusOther'), value: other });
    }
    return data;
  }, [normalizedStats.users, t]);

  const messageStatusData = useMemo(() => ([
    { label: t('admin.dashboard.unreadMessages'), value: normalizedStats.messages.unread },
    { label: t('admin.dashboard.readMessages'), value: normalizedStats.messages.read },
  ]), [normalizedStats.messages, t]);

  const miniStats = useMemo(() => {
    const { users, transactions, carbon, trendSummary } = normalizedStats;
    const activeRatioValue = users.activeRatio ?? safeDivide(users.active, users.total);
    const avgPointsValue = transactions.avgPointsPerTransaction;
    const pointsLast7Value = transactions.last7PointsAwarded ?? 0;
    const pendingCarbonValue = carbon.pendingRecords ?? 0;
    const avgDailyCarbonValue = trendSummary.averageDailyCarbon30d ?? 0;

    const formatPercentValue = (value) => {
      if (value === null || value === undefined) {
        return '--';
      }
      const numeric = Number(value);
      return Number.isFinite(numeric) ? percentFormatter.format(numeric) : '--';
    };

    const formatDecimalValue = (value, unit = '') => {
      if (value === null || value === undefined) {
        return '--';
      }
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) {
        return '--';
      }
      return `${decimalFormatter.format(numeric)}${unit}`.trim();
    };

    return [
      {
        key: 'activeRatio',
        label: t('admin.dashboard.mini.activeRatio'),
        value: formatPercentValue(activeRatioValue),
      },
      {
        key: 'avgPoints',
        label: t('admin.dashboard.mini.avgPointsPerTransaction'),
        value: formatDecimalValue(avgPointsValue, ` ${t('units.points')}`),
      },
      {
        key: 'pointsLast7',
        label: t('admin.dashboard.mini.pointsLast7'),
        value: formatDecimalValue(pointsLast7Value, ` ${t('units.points')}`),
      },
      {
        key: 'pendingCarbon',
        label: t('admin.dashboard.mini.pendingCarbonRecords'),
        value: integerFormatter.format(Math.max(0, pendingCarbonValue)),
      },
      {
        key: 'avgDailyCarbon',
        label: t('admin.dashboard.mini.averageDailyCarbon30d'),
        value: formatDecimalValue(avgDailyCarbonValue, ` ${t('units.kg')}`),
      },
    ];
  }, [normalizedStats, t, percentFormatter, decimalFormatter, integerFormatter]);

  const insights = useMemo(() => {
    const { users, transactions, exchanges, messages, carbon, trendSummary } = normalizedStats;

    const approvalRate = Number.isFinite(transactions.approvalRate)
      ? transactions.approvalRate
      : safeDivide(transactions.approved, transactions.total);
    const carbonPerUser = users.active > 0 ? carbon.totalCarbonSaved / users.active : 0;
    const unreadRate = Number.isFinite(messages.unreadRatio)
      ? messages.unreadRatio
      : safeDivide(messages.unread, messages.total);
    const pointsRedemptionRate = transactions.totalPointsAwarded > 0
      ? exchanges.totalPointsSpent / transactions.totalPointsAwarded
      : 0;
    const transactionsPerActiveUser = users.active > 0 ? transactions.total / users.active : 0;

    const weeklyDeltaText =
      trendSummary.carbonPrev7 > 0 || trendSummary.carbonLast7 > 0
        ? trendSummary.carbonDelta >= 0
          ? t('admin.dashboard.insights.carbonLast7DaysDeltaPositive', {
              delta: decimalFormatter.format(trendSummary.carbonDelta),
              rate: percentFormatter.format(Math.abs(trendSummary.carbonDeltaRate)),
            })
          : t('admin.dashboard.insights.carbonLast7DaysDeltaNegative', {
              delta: decimalFormatter.format(Math.abs(trendSummary.carbonDelta)),
              rate: percentFormatter.format(Math.abs(trendSummary.carbonDeltaRate)),
            })
        : t('admin.dashboard.noData');

    return [
      {
        key: 'approval',
        label: t('admin.dashboard.insights.approvalRate'),
        value: percentFormatter.format(approvalRate),
        description: t('admin.dashboard.insights.approvalRateHint', {
          approved: integerFormatter.format(transactions.approved),
          total: integerFormatter.format(transactions.total),
        }),
      },
      {
        key: 'carbonPerUser',
        label: t('admin.dashboard.insights.carbonPerUser'),
        value: `${decimalFormatter.format(carbonPerUser)} ${t('units.kg')}`,
        description: t('admin.dashboard.insights.carbonPerUserHint', {
          active: integerFormatter.format(users.active),
        }),
      },
      {
        key: 'weeklyCarbon',
        label: t('admin.dashboard.insights.carbonLast7Days'),
        value: `${decimalFormatter.format(trendSummary.carbonLast7)} ${t('units.kg')}`,
        description: weeklyDeltaText,
      },
      {
        key: 'unreadRate',
        label: t('admin.dashboard.insights.unreadRate'),
        value: percentFormatter.format(unreadRate),
        description: t('admin.dashboard.insights.unreadRateHint', {
          unread: integerFormatter.format(messages.unread),
          total: integerFormatter.format(messages.total),
        }),
      },
      {
        key: 'pointsRedemption',
        label: t('admin.dashboard.insights.pointsRedemption'),
        value: percentFormatter.format(pointsRedemptionRate),
        description: t('admin.dashboard.insights.pointsRedemptionHint', {
          spent: integerFormatter.format(exchanges.totalPointsSpent),
          awarded: integerFormatter.format(transactions.totalPointsAwarded),
        }),
      },
      {
        key: 'transactionsPerUser',
        label: t('admin.dashboard.insights.transactionsPerUser'),
        value: decimalFormatter.format(transactionsPerActiveUser),
        description: t('admin.dashboard.insights.transactionsPerUserHint', {
          active: integerFormatter.format(users.active),
        }),
      },
      {
        key: 'dailyCarbon',
        label: t('admin.dashboard.insights.averageDailyCarbon'),
        value: `${decimalFormatter.format(carbon.averageDailyCarbon)} ${t('units.kg')}`,
        description: t('admin.dashboard.insights.averageDailyCarbonHint', {
          records: integerFormatter.format(carbon.totalRecords),
        }),
      },
    ];
  }, [normalizedStats, t, integerFormatter, decimalFormatter, percentFormatter]);

  const topCarbonDays = useMemo(() => {
    if (!normalizedStats.trends.length) {
      return [];
    }
    return [...normalizedStats.trends]
      .sort((a, b) => b.carbon_saved - a.carbon_saved)
      .slice(0, 5);
  }, [normalizedStats.trends]);

  const summaryCards = useMemo(() => {
    const newUserShare = normalizedStats.users.total
      ? percentFormatter.format(normalizedStats.users.newUsersRatio ?? safeDivide(normalizedStats.users.new30d, normalizedStats.users.total))
      : t('admin.dashboard.noData');

    const weeklyCarbonDeltaText =
      trendSummary.carbonPrev7 > 0 || trendSummary.carbonLast7 > 0
        ? trendSummary.carbonDelta >= 0
          ? t('admin.dashboard.summaryCarbonTrendUp', {
              value: decimalFormatter.format(trendSummary.carbonDelta),
              rate: percentFormatter.format(Math.abs(trendSummary.carbonDeltaRate)),
            })
          : t('admin.dashboard.summaryCarbonTrendDown', {
              value: decimalFormatter.format(Math.abs(trendSummary.carbonDelta)),
              rate: percentFormatter.format(Math.abs(trendSummary.carbonDeltaRate)),
            })
        : t('admin.dashboard.noData');

    return [
      {
        key: 'users',
        icon: Users,
        title: t('admin.dashboard.totalUsers'),
        primary: integerFormatter.format(normalizedStats.users.total),
        secondary: `${t('admin.dashboard.activeUsers')}: ${integerFormatter.format(normalizedStats.users.active)}`,
        onClick: () => navigate('/admin/users'),
      },
      {
        key: 'newUsers',
        icon: TrendingUp,
        title: t('admin.dashboard.newUsers30d'),
        primary: integerFormatter.format(normalizedStats.users.new30d),
        secondary:
          normalizedStats.users.total > 0
            ? t('admin.dashboard.newUsers30dShare', { value: newUserShare })
            : t('admin.dashboard.noData'),
      },
      {
        key: 'transactions',
        icon: LineChartIcon,
        title: t('admin.dashboard.totalTransactions'),
        primary: integerFormatter.format(normalizedStats.transactions.total),
        secondary: `${t('admin.dashboard.approvedTransactions')}: ${integerFormatter.format(normalizedStats.transactions.approved)} · ${t('admin.dashboard.pendingTransactions')}: ${integerFormatter.format(normalizedStats.transactions.pending)}`,
        onClick: () => navigate('/admin/activities'),
      },
      {
        key: 'carbon',
        icon: Leaf,
        title: t('admin.dashboard.totalCarbonSaved'),
        primary: `${decimalFormatter.format(carbonStats.totalCarbonSaved)} ${t('units.kg')}`,
        secondary: `${t('admin.dashboard.totalPointsAwarded')}: ${integerFormatter.format(normalizedStats.transactions.totalPointsAwarded)}`,
      },
      {
        key: 'exchanges',
        icon: Package,
        title: t('admin.dashboard.totalExchanges'),
        primary: integerFormatter.format(normalizedStats.exchanges.total),
        secondary: `${t('admin.dashboard.pendingExchanges')}: ${integerFormatter.format(normalizedStats.exchanges.pending)} · ${t('admin.dashboard.totalPointsSpent')}: ${integerFormatter.format(normalizedStats.exchanges.totalPointsSpent)}`,
        onClick: () => navigate('/admin/exchanges'),
      },
      {
        key: 'activities',
        icon: Activity,
        title: t('admin.dashboard.totalActivities'),
        primary: integerFormatter.format(normalizedStats.activities.totalRecords),
        secondary: `${t('admin.dashboard.approvedActivities')}: ${integerFormatter.format(normalizedStats.activities.approvedRecords)} · ${t('admin.dashboard.pendingActivities')}: ${integerFormatter.format(normalizedStats.activities.pendingRecords)}`,
        onClick: () => navigate('/admin/activities'),
      },
      {
        key: 'messages',
        icon: MessageSquare,
        title: t('admin.dashboard.totalMessages'),
        primary: integerFormatter.format(normalizedStats.messages.total),
        secondary: `${t('admin.dashboard.unreadMessages')}: ${integerFormatter.format(normalizedStats.messages.unread)}`,
        onClick: () => navigate('/admin/broadcast'),
      },
      {
        key: 'carbon7d',
        icon: Leaf,
        title: t('admin.dashboard.carbonSaved7d'),
        primary: `${decimalFormatter.format(trendSummary.carbonLast7)} ${t('units.kg')}`,
        secondary: weeklyCarbonDeltaText,
      },
    ];
  }, [normalizedStats, trendSummary, t, integerFormatter, decimalFormatter, percentFormatter, navigate, carbonStats]);

  const renderDonutChart = (data) => {
    const total = data.reduce((sum, item) => sum + safeNumber(item.value), 0);
    if (total <= 0) {
      return (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          {t('admin.dashboard.noData')}
        </div>
      );
    }
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="label" innerRadius={60} outerRadius={90} paddingAngle={3}>
            {data.map((entry, index) => (
              <Cell key={entry.label} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value, name) => [integerFormatter.format(value), name]} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <LineChartIcon className="h-5 w-5" />
                {t('admin.dashboard.title')}
              </CardTitle>
              <CardDescription>{t('admin.dashboard.description')}</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="accent-green-600"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                />
                {t('admin.dashboard.autoRefresh')}
              </label>
              <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
                {t('admin.dashboard.refreshNow')}
              </Button>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>
                  {t('admin.dashboard.lastUpdated')}: {lastUpdated ? lastUpdated.toLocaleString() : '--'}
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-green-500" />
              <span className="ml-2 text-muted-foreground">{t('common.loading')}</span>
            </div>
          )}
          {isError && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t('common.error')}</AlertTitle>
              <AlertDescription>{error?.message || t('errors.loadFailed')}</AlertDescription>
            </Alert>
          )}
          {!isLoading && !isError && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {summaryCards.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Card
                      key={item.key}
                      className={'p-4' + (item.onClick ? ' cursor-pointer hover:bg-accent/40 transition' : '')}
                      onClick={item.onClick}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.title}</p>
                            <p className="mt-1 text-2xl font-semibold leading-tight">{item.primary}</p>
                          </div>
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-muted-foreground">{item.secondary}</p>
                    </Card>
                  );
                })}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
                {miniStats.map((item) => (
                  <div key={item.key} className="rounded-md border border-border/60 p-4 text-sm">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
                    <p className="mt-2 text-lg font-semibold">{item.value}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {!isLoading && !isError && (
        <>
          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>{t('admin.dashboard.trendsTitle')}</CardTitle>
                  <CardDescription>{t('admin.dashboard.trendsSubtitle')}</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/admin/activities')}>
                  {t('admin.dashboard.viewActivities')}
                </Button>
              </CardHeader>
              <CardContent className="h-80">
                {trendChartData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={trendChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" minTickGap={20} tickFormatter={(value) => formatDateLabel(value, shortDateFormatter)} />
                      <YAxis yAxisId="left" allowDecimals={false} />
                      <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => decimalFormatter.format(value)} />
                      <Tooltip
                        labelFormatter={(value) => formatDateLabel(value, longDateFormatter)}
                        formatter={(value, name) => {
                          if (typeof value === 'number') {
                            if (
                              name === t('admin.dashboard.trendsCarbonSaved') ||
                              name === t('admin.dashboard.trendsCarbonAverage')
                            ) {
                              return [`${decimalFormatter.format(value)} ${t('units.kg')}`, name];
                            }
                            return [integerFormatter.format(value), name];
                          }
                          return [value, name];
                        }}
                      />
                      <Legend />
                      <Bar
                        yAxisId="left"
                        dataKey="transactions"
                        name={t('admin.dashboard.trendsTransactions')}
                        fill="hsl(var(--chart-3))"
                        radius={[4, 4, 0, 0]}
                      />
                      <Area
                        yAxisId="right"
                        type="monotone"
                        dataKey="carbon_saved"
                        name={t('admin.dashboard.trendsCarbonSaved')}
                        stroke="hsl(var(--chart-1))"
                        fill="hsl(var(--chart-1))"
                        fillOpacity={0.15}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="carbon_avg"
                        name={t('admin.dashboard.trendsCarbonAverage')}
                        stroke="hsl(var(--chart-5))"
                        strokeWidth={2}
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    {t('admin.dashboard.noData')}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('admin.dashboard.keyInsights')}</CardTitle>
                <CardDescription>{t('admin.dashboard.keyInsightsSubtitle')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {insights.map((insight) => (
                    <div key={insight.key} className="rounded-md border border-border/60 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">{insight.label}</span>
                        <span className="text-lg font-semibold">{insight.value}</span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">{insight.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('admin.dashboard.transactionStatusTitle')}</CardTitle>
                <CardDescription>{t('admin.dashboard.transactionStatusSubtitle')}</CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                {renderDonutChart(transactionStatusData)}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('admin.dashboard.userStatusTitle')}</CardTitle>
                <CardDescription>{t('admin.dashboard.userStatusSubtitle', {
                  newUsers: integerFormatter.format(normalizedStats.users.new30d),
                })}</CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                {renderDonutChart(userStatusData)}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('admin.dashboard.exchangeStatusTitle')}</CardTitle>
                <CardDescription>{t('admin.dashboard.exchangeStatusSubtitle')}</CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                {renderDonutChart(exchangeStatusData)}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('admin.dashboard.messageStatusTitle')}</CardTitle>
                <CardDescription>{t('admin.dashboard.messageStatusSubtitle')}</CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                {renderDonutChart(messageStatusData)}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>{t('admin.dashboard.topCarbonDaysTitle')}</CardTitle>
                <CardDescription>{t('admin.dashboard.topCarbonDaysSubtitle')}</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/activities')}>
                {t('admin.dashboard.viewActivities')}
              </Button>
            </CardHeader>
            <CardContent>
              {topCarbonDays.length ? (
                <div className="space-y-3">
                  {topCarbonDays.map((day) => (
                    <div
                      key={day.date}
                      className="flex items-center justify-between rounded-md border border-border/60 px-4 py-3"
                    >
                      <div>
                        <p className="font-medium">{formatDateLabel(day.date, longDateFormatter)}</p>
                        <p className="text-xs text-muted-foreground">
                          {t('admin.dashboard.trendsTransactions')}: {integerFormatter.format(day.transactions)}
                        </p>
                      </div>
                      <div className="text-sm font-semibold">
                        {decimalFormatter.format(day.carbon_saved)} {t('units.kg')}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">{t('admin.dashboard.noData')}</div>
              )}
            </CardContent>
          </Card>
          <div className="grid gap-6 xl:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>{t('admin.dashboard.recentPendingTransactions')}</CardTitle>
                <CardDescription>{t('admin.dashboard.recentPendingTransactionsSubtitle')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {recent.pendingTransactions.length ? (
                  recent.pendingTransactions.map((item) => (
                    <div key={item.id} className="rounded-md border border-border/60 px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{item.username || t('admin.dashboard.unknownUser')}</span>
                        <span className="font-mono">{decimalFormatter.format(safeNumber(item.points))} {t('units.points')}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{formatDateTime(item.created_at)}</span>
                        <span className="uppercase tracking-wide">{item.status}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground">{t('admin.dashboard.noPendingTransactions')}</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('admin.dashboard.recentPendingCarbon')}</CardTitle>
                <CardDescription>{t('admin.dashboard.recentPendingCarbonSubtitle')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {recent.pendingCarbonRecords.length ? (
                  recent.pendingCarbonRecords.map((item) => (
                    <div key={item.id} className="rounded-md border border-border/60 px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{item.activity_name_en || item.activity_name_zh || item.activity_id || t('admin.dashboard.unknownActivity')}</span>
                        <span className="font-mono">{decimalFormatter.format(safeNumber(item.carbon_saved))} {t('units.kg')}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{item.username || t('admin.dashboard.unknownUser')}</span>
                        <span>{formatDateTime(item.created_at)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground">{t('admin.dashboard.noPendingCarbon')}</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('admin.dashboard.latestUsers')}</CardTitle>
                <CardDescription>{t('admin.dashboard.latestUsersSubtitle')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {recent.latestUsers.length ? (
                  recent.latestUsers.map((item) => (
                    <div key={item.id} className="rounded-md border border-border/60 px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{item.username}</span>
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">{item.status || t('admin.dashboard.statusUnknown')}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {item.email || t('admin.dashboard.noEmail')}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatDateTime(item.created_at)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground">{t('admin.dashboard.noRecentUsers')}</div>
                )}
              </CardContent>
            </Card>
          </div>


        </>
      )}
    </div>
  );
}
