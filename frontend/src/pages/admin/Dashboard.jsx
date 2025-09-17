import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { adminAPI } from '../../lib/api';
import { useTranslation } from '../../hooks/useTranslation';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/Alert';
import { Loader2, AlertCircle, RefreshCw, LineChart as LineChartIcon, Clock } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

export default function AdminDashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const refreshIntervalMs = 30000;

  const { data: statsData, isLoading, isError, error, refetch, isFetching } = useQuery(
    ['adminStats'],
    () => adminAPI.getStats().then(res => res.data?.data || {}),
    {
      staleTime: 15000,
      refetchOnWindowFocus: false,
      refetchInterval: autoRefresh ? refreshIntervalMs : false,
      onSuccess: () => setLastUpdated(new Date()),
    }
  );

  const number = useMemo(() => new Intl.NumberFormat(), []);
  const decimal = useMemo(() => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }), []);

  return (
    <div>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="flex items-center gap-2">
              <LineChartIcon className="h-5 w-5" />
              {t('admin.dashboard.title')}
            </CardTitle>
            <div className="flex items-center gap-3">
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
                  {t('admin.dashboard.lastUpdated')}: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '--'}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-2">
                <Card className="p-4 cursor-pointer hover:bg-accent/30 transition" onClick={() => navigate('/admin/users')}>
                  <h3 className="font-semibold">{t('admin.dashboard.totalUsers')}</h3>
                  <p className="text-2xl font-bold">{number.format(statsData?.users?.total_users ?? 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t('admin.dashboard.activeUsers')}: {number.format(statsData?.users?.active_users ?? 0)}</p>
                </Card>
                <Card className="p-4">
                  <h3 className="font-semibold">{t('admin.dashboard.newUsers30d')}</h3>
                  <p className="text-2xl font-bold">{number.format(statsData?.users?.new_users_30d ?? 0)}</p>
                </Card>
                <Card className="p-4 cursor-pointer hover:bg-accent/30 transition" onClick={() => navigate('/admin/activities')}>
                  <h3 className="font-semibold">{t('admin.dashboard.totalTransactions')}</h3>
                  <p className="text-2xl font-bold">{number.format(statsData?.transactions?.total_transactions ?? 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t('admin.dashboard.rejectedTransactions')}: {number.format(statsData?.transactions?.rejected_transactions ?? 0)}</p>
                </Card>
                <Card className="p-4">
                  <h3 className="font-semibold">{t('admin.dashboard.totalCarbonSaved')}</h3>
                  <p className="text-2xl font-bold">{decimal.format(statsData?.transactions?.total_carbon_saved ?? 0)} {t('units.kg')}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t('admin.dashboard.totalPointsAwarded')}: {number.format(statsData?.transactions?.total_points_awarded ?? 0)}</p>
                </Card>
                <Card className="p-4 cursor-pointer hover:bg-accent/30 transition" onClick={() => navigate('/admin/exchanges')}>
                  <h3 className="font-semibold">{t('admin.dashboard.totalExchanges')}</h3>
                  <p className="text-2xl font-bold">{number.format(statsData?.exchanges?.total_exchanges ?? 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t('admin.dashboard.totalPointsSpent')}: {number.format(statsData?.exchanges?.total_points_spent ?? 0)}</p>
                </Card>
                <Card className="p-4 cursor-pointer hover:bg-accent/30 transition" onClick={() => navigate('/admin/activities')}>
                  <h3 className="font-semibold">{t('admin.dashboard.totalActivities')}</h3>
                  <p className="text-2xl font-bold">{number.format(statsData?.activities?.total_activities ?? 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t('admin.dashboard.activeActivities')}: {number.format(statsData?.activities?.active_activities ?? 0)}</p>
                </Card>
              </div>

              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-2">{t('admin.dashboard.trendsTitle')}</h3>
                <p className="text-sm text-muted-foreground mb-4">{t('admin.dashboard.trendsSubtitle')}</p>
                <div className="h-72">
                  <ResponsiveContainer>
                    <ComposedChart data={statsData?.trends || []} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis yAxisId="left" allowDecimals={false} />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="transactions" name={t('admin.dashboard.trendsTransactions')} fill="hsl(var(--chart-2))" />
                      <Line yAxisId="right" type="monotone" dataKey="carbon_saved" name={t('admin.dashboard.trendsCarbonSaved')} stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
