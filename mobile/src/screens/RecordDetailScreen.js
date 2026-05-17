import React from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { FrostedBackButton, GlassListItemSurface, GlassSurface, PageHeader, ScreenBackground } from '../components/Glass';
import ImageLightbox from '../components/ImageLightbox';
import { carbonApi } from '../api/carbon';
import { useI18n } from '../i18n';
import { useTheme } from '../theme';
import { useEdgeSwipeBack } from '../lib/navigationGestures';

const formatNumber = (value) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(Number(value || 0));
const formatSubmittedDate = (record) => {
  const value = record.created_at || record.submitted_at || '';
  return String(value).split(/[T ]/)[0];
};

const getRecordName = (item, language) => {
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

function DetailMetric({ label, value }) {
  const { colors } = useTheme();
  return (
    <GlassListItemSurface style={styles.metric} contentStyle={styles.metricContent}>
      <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.metricValue, { color: colors.text }]}>
        {value}
      </Text>
    </GlassListItemSurface>
  );
}

function DetailRow({ label, value }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  return (
    <GlassListItemSurface style={styles.detailRow} contentStyle={styles.detailRowContent}>
      <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.text }]}>{value || t('app.emptyValue')}</Text>
    </GlassListItemSurface>
  );
}

export default function RecordDetailScreen({ route, navigation, swipeBack: providedSwipeBack }) {
  const { t, resolvedLanguage } = useI18n();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isWide = width >= 720;
  const localSwipeBack = useEdgeSwipeBack(navigation);
  const swipeBack = providedSwipeBack || localSwipeBack;
  const id = route.params?.id;
  const initialRecord = route.params?.record;

  const detailQuery = useQuery({
    queryKey: ['mobile-carbon-record', id],
    queryFn: () => carbonApi.getRecord(id),
    enabled: Boolean(id),
    initialData: initialRecord,
  });

  const record = detailQuery.data || {};
  const images = Array.isArray(record.images) ? record.images : [];
  const firstImage = images.find((item) => item?.url || item?.public_url);
  const imageUrl = firstImage?.url || firstImage?.public_url;
  const imageSource = imageUrl ? { uri: imageUrl, cache: 'force-cache' } : null;

  return (
    <ScreenBackground {...swipeBack.panHandlers} animatedStyle={swipeBack.animatedStyle}>
      <FrostedBackButton accessibilityLabel={t('record.back')} onPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.container, isWide ? styles.containerWide : null]}>
        <PageHeader
          eyebrow={t('record.detailEyebrow')}
          title={getRecordName(record, resolvedLanguage) || t('record.activityFallback')}
          subtitle={t(statusKey(record.status))}
        />

        <GlassSurface contentStyle={styles.content}>
          {detailQuery.isFetching ? <ActivityIndicator color={colors.primary} /> : null}
          {imageSource ? (
            <ImageLightbox source={imageSource} uri={imageUrl} style={styles.imageSurface} contentStyle={styles.imageContent}>
              <Image resizeMode="contain" source={imageSource} style={styles.image} />
            </ImageLightbox>
          ) : null}
          <View style={[styles.metricGrid, isWide ? styles.metricGridWide : null]}>
            <DetailMetric label={t('record.carbonSaved')} value={`${formatNumber(record.carbon_saved)} ${t('units.kgCo2e')}`} />
            <DetailMetric label={t('record.pointsEarned')} value={`+${formatNumber(record.points_earned)} ${t('units.points')}`} />
          </View>
          <View style={styles.details}>
            <DetailRow label={t('record.amount')} value={`${formatNumber(record.amount)} ${record.unit || ''}`} />
            <DetailRow label={t('record.activityDate')} value={record.date} />
            <DetailRow label={t('record.category')} value={record.category} />
            <DetailRow label={t('record.description')} value={record.description} />
            <DetailRow label={t('record.createdAt')} value={formatSubmittedDate(record)} />
            <DetailRow label={t('record.reviewNote')} value={record.review_note || record.admin_notes} />
          </View>
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
    paddingTop: 82,
  },
  containerWide: {
    alignSelf: 'center',
    maxWidth: 860,
    width: '100%',
  },
  content: {
    gap: 16,
  },
  image: {
    aspectRatio: 1.65,
    width: '100%',
  },
  imageContent: {
    width: '100%',
  },
  imageSurface: {
    borderRadius: 20,
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  metricGridWide: {
    maxWidth: 560,
  },
  metric: {
    borderRadius: 18,
    flex: 1,
    minHeight: 96,
  },
  metricContent: {
    padding: 14,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '900',
    marginTop: 10,
  },
  details: {
    gap: 10,
  },
  detailRow: {
    borderRadius: 18,
  },
  detailRowContent: {
    gap: 6,
    padding: 12,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
});
