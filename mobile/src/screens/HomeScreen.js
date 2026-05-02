import React, { useCallback } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { GlassContainer, GlassSurface, PageHeader, ScreenBackground } from '../components/Glass';
import CarbonRecordList from '../components/CarbonRecordList';
import ResponsiveTrendChart from '../components/ResponsiveTrendChart';
import { dashboardApi } from '../api/dashboard';
import useAuthStore from '../store/authStore';
import { useI18n } from '../i18n';
import { useTheme } from '../theme';

const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

const formatNumber = (value) => numberFormat.format(Number(value || 0));
function StatCard({ label, value, suffix }) {
  const { colors } = useTheme();
  return (
    <GlassSurface effect="clear" style={styles.statCard} tintColor={colors.primarySoft}>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.statValue, { color: colors.text }]}>
        {value}
      </Text>
      {suffix ? <Text style={[styles.statSuffix, { color: colors.primary }]}>{suffix}</Text> : null}
    </GlassSurface>
  );
}

export default function HomeScreen({ navigation }) {
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

        <GlassContainer spacing={12} style={[styles.statGrid, isWide ? styles.statGridWide : null]}>
          <StatCard label={t('home.currentPoints')} value={formatNumber(stats.current_points)} suffix={t('units.points')} />
          <StatCard label={t('home.carbonSaved')} value={formatNumber(stats.total_carbon_saved)} suffix={t('units.kgCo2e')} />
          <StatCard label={t('home.totalActivities')} value={formatNumber(stats.total_activities)} />
          <StatCard label={t('home.pendingActivities')} value={formatNumber(stats.pending_activities)} />
        </GlassContainer>

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
          <CarbonRecordList
            records={activities}
            emptyText={t('home.emptyActivities')}
            onRecordPress={(record) => navigation.navigate('Record', { detailRecord: { id: record.id, record } })}
          />
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
    borderRadius: 22,
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
});
