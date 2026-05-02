import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassPressable } from './Glass';
import { useI18n } from '../i18n';
import { useTheme } from '../theme';

const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const formatNumber = (value) => numberFormat.format(Number(value || 0));

const formatSubmittedDate = (item) => {
  const value = item.created_at || item.submitted_at || '';
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

export function CarbonRecordRow({ item, onPress }) {
  const { t, resolvedLanguage } = useI18n();
  const { colors } = useTheme();
  return (
    <GlassPressable
      disabled={!onPress}
      onPress={onPress}
      style={styles.row}
      contentStyle={styles.rowContent}
    >
      <View style={styles.main}>
        <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>
          {getRecordName(item, resolvedLanguage) || t('record.activityFallback')}
        </Text>
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          {t(statusKey(item.status))} / {t('record.submittedAt', { date: formatSubmittedDate(item) || t('app.emptyValue') })}
        </Text>
      </View>
      <View style={styles.metrics}>
        <Text style={[styles.carbon, { color: colors.primary }]}>
          {formatNumber(item.carbon_saved)} {t('units.kgCo2e')}
        </Text>
        <Text style={[styles.points, { color: colors.textMuted }]}>
          +{formatNumber(item.points_earned)} {t('units.points')}
        </Text>
      </View>
      {onPress ? <Ionicons color={colors.textMuted} name="chevron-forward" size={18} /> : null}
    </GlassPressable>
  );
}

export default function CarbonRecordList({ emptyText, onRecordPress, records = [] }) {
  const { colors } = useTheme();
  if (!records.length) {
    return <Text style={[styles.emptyText, { color: colors.textMuted }]}>{emptyText}</Text>;
  }
  return (
    <View style={styles.list}>
      {records.map((record) => (
        <CarbonRecordRow
          key={record.id}
          item={record}
          onPress={onRecordPress ? () => onRecordPress(record) : null}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  carbon: {
    fontSize: 13,
    fontWeight: '900',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  list: {
    gap: 10,
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  meta: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  metrics: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  points: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  row: {
    borderRadius: 18,
    minHeight: 74,
  },
  rowContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 74,
    padding: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '900',
  },
});
