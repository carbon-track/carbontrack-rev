import React, { useMemo } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GlassSurface } from './Glass';
import { useTheme } from '../theme';

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const shortDate = (value) => {
  if (!value) {
    return '';
  }
  const [date] = String(value).split(' ');
  const parts = date.split('-');
  if (parts.length >= 3) {
    return `${parts[1]}/${parts[2]}`;
  }
  return String(value).slice(0, 5);
};

export default function ResponsiveBarChart({ data = [], emptyLabel, title, valueKey, valueLabel }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isWide = width >= 720;
  const visibleCount = isWide ? 30 : 14;
  const chartHeight = isWide ? 220 : 168;

  const points = useMemo(() => {
    const source = Array.isArray(data) ? data : [];
    return source.slice(-visibleCount).map((item) => ({
      label: shortDate(item.date || item.month || item.label),
      value: toNumber(item[valueKey]),
    }));
  }, [data, valueKey, visibleCount]);

  const maxValue = Math.max(1, ...points.map((point) => point.value));
  const labelInterval = points.length <= 6 ? 1 : Math.ceil(points.length / (isWide ? 6 : 4));

  return (
    <GlassSurface contentStyle={styles.panel} effect="clear" style={styles.panelShell}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.valueLabel, { color: colors.textMuted }]}>{valueLabel}</Text>
      </View>

      {points.length ? (
        <View style={[styles.chart, { height: chartHeight }]}>
          <View style={styles.bars}>
            {points.map((point, index) => {
              const height = Math.max(5, Math.round((point.value / maxValue) * (chartHeight - 46)));
              const showLabel = index === 0 || index === points.length - 1 || index % labelInterval === 0;
              return (
                <View key={`${point.label}-${index}`} style={styles.slot}>
                  <View style={[styles.barTrack, { backgroundColor: colors.surfaceStrong }]}>
                    <View style={[styles.bar, { backgroundColor: colors.primary, height }]} />
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[styles.axisLabel, { color: showLabel ? colors.textMuted : 'transparent' }]}
                  >
                    {showLabel ? point.label : '-'}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : (
        <View style={[styles.empty, { height: chartHeight }]}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>{emptyLabel}</Text>
        </View>
      )}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  panelShell: {
    borderRadius: 20,
  },
  panel: {
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
  },
  valueLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  chart: {
    justifyContent: 'flex-end',
    width: '100%',
  },
  bars: {
    alignItems: 'stretch',
    flex: 1,
    flexDirection: 'row',
    gap: 5,
  },
  slot: {
    alignItems: 'center',
    flex: 1,
    gap: 8,
    justifyContent: 'flex-end',
    minWidth: 0,
  },
  barTrack: {
    alignItems: 'center',
    borderRadius: 999,
    flex: 1,
    justifyContent: 'flex-end',
    minHeight: 110,
    overflow: 'hidden',
    width: '100%',
  },
  bar: {
    borderRadius: 999,
    width: '100%',
  },
  axisLabel: {
    fontSize: 10,
    fontWeight: '700',
    height: 14,
    maxWidth: 46,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});
