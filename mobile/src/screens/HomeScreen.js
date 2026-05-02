import React, { useCallback } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { GlassSurface, PageHeader, ScreenBackground } from '../components/Glass';
import ResponsiveTrendChart from '../components/ResponsiveTrendChart';
import { dashboardApi } from '../api/dashboard';
import useAuthStore from '../store/authStore';
import { useI18n } from '../i18n';
import { useTheme } from '../theme';

const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

const formatNumber = (value) => numberFormat.format(Number(value || 0));
const formatSubmittedDate = (item) => {
  const value = item.created_at || item.submitted_at || '';
  return String(value).split(/[T ]/)[0];
};

const getActivityName = (item, language) => {
  if (language === 'zh') {
    return item.activity_name_zh || item.activity_name_en || item.category || '';
  }
  return item.activity_name_en || item.activity_name_zh || item.category || '';
};

const statusKey = (status) => {
  if (status === 'approved' || status === 'pending' || status === 'rejected') {
    return `record.status.${status}`;
  }
  return 'record.status.unknown';
};

function StatCard({ label, value, suffix }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.statCard, { backgroundColor: colors.surfaceMuted, borderColor: colors.borderStrong }]}>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.statValue, { color: colors.text }]}>
        {value}
      </Text>
      {suffix ? <Text style={[styles.statSuffix, { color: colors.primary }]}>{suffix}</Text> : null}
    </View>
  );
}

function ActivityRow({ item }) {
  const { t, resolvedLanguage } = useI18n();
  const { colors } = useTheme();
  return (
    <View style={[styles.activityRow, { borderColor: colors.borderStrong }]}>
      <View style={styles.activityText}>
        <Text numberOfLines={1} style={[styles.activityTitle, { color: colors.text }]}>
          {getActivityName(item, resolvedLanguage) || t('record.activityFallback')}
        </Text>
        <Text style={[styles.activityMeta, { color: colors.textMuted }]}>
          {t(statusKey(item.status))} / {t('record.submittedAt', { date: formatSubmittedDate(item) || t('app.emptyValue') })}
        </Text>
      </View>
      <View style={styles.activityMetrics}>
        <Text style={[styles.activityCarbon, { color: colors.primary }]}>
          {formatNumber(item.carbon_saved)} {t('units.kgCo2e')}
        </Text>
        <Text style={[styles.activityPoints, { color: colors.textMuted }]}>
          +{formatNumber(item.points_earned)} {t('units.points')}
        </Text>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const user = useAuthStore((state) => state.user);
  const name = user?.username || t('app.fallbackUser');
  const isWide = width >= 720;

  const statsQuery = useQuery({
    queryKey: ['mobile-dashboard-stats'],
    queryFn: dashboardApi.getStats,
  });
  const chartQuery = useQuery({
    queryKey: ['mobile-dashboard-chart', 30],
    queryFn: () => dashboardApi.getChartData({ period: 30 }),
  });
  const activitiesQuery = useQuery({
    queryKey: ['mobile-dashboard-activities'],
    queryFn: () => dashboardApi.getRecentActivities({ limit: 8 }),
  });

  const refreshing = statsQuery.isFetching || chartQuery.isFetching || activitiesQuery.isFetching;
  const refresh = useCallback(() => {
    statsQuery.refetch();
    chartQuery.refetch();
    activitiesQuery.refetch();
  }, [activitiesQuery, chartQuery, statsQuery]);

  const stats = statsQuery.data || {};
  const activities = Array.isArray(activitiesQuery.data) ? activitiesQuery.data : [];
  const chartData = Array.isArray(chartQuery.data) ? chartQuery.data : [];

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={[styles.container, isWide ? styles.containerWide : null]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <PageHeader eyebrow={t('home.eyebrow')} title={t('home.title', { name })} subtitle={t('home.subtitle')} />

        <View style={[styles.statGrid, isWide ? styles.statGridWide : null]}>
          <StatCard label={t('home.currentPoints')} value={formatNumber(stats.current_points)} suffix={t('units.points')} />
          <StatCard label={t('home.carbonSaved')} value={formatNumber(stats.total_carbon_saved)} suffix={t('units.kgCo2e')} />
          <StatCard label={t('home.totalActivities')} value={formatNumber(stats.total_activities)} />
          <StatCard label={t('home.pendingActivities')} value={formatNumber(stats.pending_activities)} />
        </View>

        <GlassSurface contentStyle={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('home.overview')}</Text>
            {statsQuery.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
          </View>
          <View style={[styles.chartGrid, isWide ? styles.chartGridWide : null]}>
            <View style={styles.chartItem}>
              <ResponsiveTrendChart
                data={chartData}
                description={t('home.activityTrendDescription')}
                emptyLabel={t('home.emptyChart')}
                title={t('home.carbonChart')}
                valueKey="carbon_saved"
                valueLabel={t('units.kgCo2e')}
              />
            </View>
            <View style={styles.chartItem}>
              <ResponsiveTrendChart
                data={chartData}
                description={t('home.pointsTrendDescription')}
                emptyLabel={t('home.emptyChart')}
                title={t('home.pointsChart')}
                valueKey="points"
                valueLabel={t('units.points')}
              />
            </View>
          </View>
        </GlassSurface>

        <GlassSurface contentStyle={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('home.recentActivities')}</Text>
            {activitiesQuery.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
          </View>
          {activities.length ? (
            <View style={styles.activityList}>
              {activities.map((item) => <ActivityRow key={item.id} item={item} />)}
            </View>
          ) : (
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('home.emptyActivities')}</Text>
          )}
        </GlassSurface>
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 18,
    padding: 20,
    paddingBottom: 128,
  },
  containerWide: {
    alignSelf: 'center',
    maxWidth: 980,
    width: '100%',
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statGridWide: {
    flexWrap: 'nowrap',
  },
  statCard: {
    borderRadius: 20,
    borderWidth: 1,
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 116,
    padding: 16,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  statValue: {
    fontSize: 30,
    fontWeight: '900',
    marginTop: 12,
  },
  statSuffix: {
    fontSize: 12,
    fontWeight: '900',
    marginTop: 4,
  },
  section: {
    gap: 16,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  chartGrid: {
    gap: 14,
  },
  chartGridWide: {
    flexDirection: 'row',
  },
  chartItem: {
    flex: 1,
    minWidth: 0,
  },
  activityList: {
    gap: 10,
  },
  activityRow: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 64,
    paddingBottom: 10,
  },
  activityText: {
    flex: 1,
    minWidth: 0,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  activityMeta: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  activityMetrics: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  activityCarbon: {
    fontSize: 13,
    fontWeight: '900',
  },
  activityPoints: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
});
