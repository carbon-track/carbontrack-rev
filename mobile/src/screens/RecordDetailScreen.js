import React from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { GlassButtonSurface, GlassListItemSurface, GlassSurface, PageHeader, ScreenBackground } from '../components/Glass';
import ImageLightbox from '../components/ImageLightbox';
import { carbonApi } from '../api/carbon';
import { useI18n } from '../i18n';
import { makeShadow, useTheme } from '../theme';

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

export default function RecordDetailScreen({ route, navigation }) {
  const { t, resolvedLanguage } = useI18n();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isWide = width >= 720;
  const backButtonGlass = colors.dark ? 'rgba(18, 44, 32, 0.96)' : 'rgba(248, 251, 248, 0.96)';
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

  return (
    <ScreenBackground>
      <GlassButtonSurface
        contentStyle={styles.backButtonContent}
        effect="regular"
        onPress={() => navigation.goBack()}
        style={[
          styles.backButton,
          {
            backgroundColor: backButtonGlass,
            borderColor: colors.borderStrong,
            borderWidth: 1.5,
          },
          makeShadow(colors, colors.dark ? 0.34 : 0.18, 12),
        ]}
        tintColor={backButtonGlass}
        wrapperStyle={styles.floatingBackButton}
      >
        <Ionicons color={colors.primary} name="chevron-back" size={18} />
        <Text style={[styles.backText, { color: colors.primary }]}>{t('record.back')}</Text>
      </GlassButtonSurface>
      <ScrollView contentContainerStyle={[styles.container, isWide ? styles.containerWide : null]}>
        <PageHeader
          eyebrow={t('record.detailEyebrow')}
          title={getRecordName(record, resolvedLanguage) || t('record.activityFallback')}
          subtitle={t(statusKey(record.status))}
        />

        <GlassSurface contentStyle={styles.content}>
          {detailQuery.isFetching ? <ActivityIndicator color={colors.primary} /> : null}
          {imageUrl ? (
            <ImageLightbox uri={imageUrl} title={getRecordName(record, resolvedLanguage) || t('record.activityFallback')} style={styles.imageSurface} contentStyle={styles.imageContent}>
              <Image source={{ uri: imageUrl }} style={styles.image} />
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
  backButton: {
    borderRadius: 999,
    minHeight: 38,
    paddingHorizontal: 12,
    width: 'auto',
  },
  backButtonContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
  },
  backText: {
    fontSize: 14,
    fontWeight: '900',
    includeFontPadding: false,
    lineHeight: 18,
  },
  content: {
    gap: 16,
  },
  floatingBackButton: {
    left: 20,
    position: 'absolute',
    top: 54,
    zIndex: 20,
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
