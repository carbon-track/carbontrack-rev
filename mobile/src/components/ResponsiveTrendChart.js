import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useTheme } from '../theme';

const AXIS_WIDTH = 40;
const PLOT_RIGHT = 12;
const PLOT_TOP = 8;
const PLOT_BOTTOM = 26;

const compactNumber = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
  notation: 'compact',
});

const dateLabel = (value) => {
  if (!value) {
    return '';
  }

  if (typeof value === 'string' && value.includes('-')) {
    const date = new Date(`${value}T00:00:00`);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' });
    }
  }

  return String(value);
};

const toValue = (item, key) => {
  const raw = item?.[key] ?? 0;
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
};

function Segment({ color, from, thickness = 3, to }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt((dx * dx) + (dy * dy));
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  if (!length) {
    return null;
  }

  return (
    <View
      style={[
        styles.segment,
        {
          backgroundColor: color,
          borderRadius: thickness,
          height: thickness,
          left: from.x + (dx / 2) - (length / 2),
          top: from.y + (dy / 2) - (thickness / 2),
          transform: [{ rotate: `${angle}deg` }],
          width: length,
        },
      ]}
    />
  );
}

function Dot({ color, point, size = 8 }) {
  return (
    <View
      style={[
        styles.dot,
        {
          backgroundColor: color,
          borderColor: color,
          borderRadius: size / 2,
          height: size,
          left: point.x - (size / 2),
          top: point.y - (size / 2),
          width: size,
        },
      ]}
    />
  );
}

export default function ResponsiveTrendChart({
  data = [],
  description,
  emptyLabel,
  title,
  valueKey,
  valueLabel,
}) {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const [layoutWidth, setLayoutWidth] = useState(0);
  const chartHeight = width >= 720 ? 244 : 196;
  const lineColor = colors.primary;
  const plotWidth = Math.max(0, layoutWidth - AXIS_WIDTH - PLOT_RIGHT);
  const plotHeight = Math.max(0, chartHeight - PLOT_TOP - PLOT_BOTTOM);

  const points = useMemo(() => (
    Array.isArray(data)
      ? data.map((item) => ({
        label: dateLabel(item?.date || item?.month || item?.label),
        value: toValue(item, valueKey),
      }))
      : []
  ), [data, valueKey]);

  const visiblePoints = width >= 720 ? points.slice(-30) : points.slice(-14);
  const maxValue = Math.max(1, ...visiblePoints.map((point) => point.value));
  const yTicks = [maxValue, maxValue / 2, 0];
  const hasData = visiblePoints.length > 0;

  const plottedPoints = useMemo(() => {
    if (!hasData || !plotWidth || !plotHeight) {
      return [];
    }

    const denominator = Math.max(visiblePoints.length - 1, 1);
    return visiblePoints.map((point, index) => ({
      ...point,
      x: AXIS_WIDTH + ((plotWidth * index) / denominator),
      y: PLOT_TOP + plotHeight - ((point.value / maxValue) * plotHeight),
    }));
  }, [hasData, maxValue, plotHeight, plotWidth, visiblePoints]);

  const axisLabels = useMemo(() => {
    if (visiblePoints.length <= 1) {
      return visiblePoints.map((point) => point.label);
    }

    const middle = Math.floor((visiblePoints.length - 1) / 2);
    return [
      visiblePoints[0]?.label,
      visiblePoints.length > 2 ? visiblePoints[middle]?.label : '',
      visiblePoints[visiblePoints.length - 1]?.label,
    ];
  }, [visiblePoints]);

  return (
    <View style={[styles.panel, { backgroundColor: colors.surfaceMuted, borderColor: colors.borderStrong }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {description ? <Text style={[styles.description, { color: colors.textMuted }]}>{description}</Text> : null}
        </View>
        <Text style={[styles.valueLabel, { color: colors.textMuted }]}>{valueLabel}</Text>
      </View>

      {hasData ? (
        <View
          onLayout={(event) => setLayoutWidth(event.nativeEvent.layout.width)}
          style={[styles.chart, { height: chartHeight }]}
        >
          {layoutWidth > 0 ? (
            <>
              {yTicks.map((tick, index) => {
                const top = PLOT_TOP + ((plotHeight * index) / 2);
                return (
                  <React.Fragment key={tick}>
                    <Text
                      numberOfLines={1}
                      style={[styles.yTick, { color: colors.textMuted, top: top - 8 }]}
                    >
                      {compactNumber.format(tick)}
                    </Text>
                    <View
                      style={[
                        styles.gridLine,
                        {
                          backgroundColor: colors.borderStrong,
                          left: AXIS_WIDTH,
                          opacity: isDark ? 0.48 : 0.72,
                          top,
                          width: plotWidth,
                        },
                      ]}
                    />
                  </React.Fragment>
                );
              })}

              {plottedPoints.slice(1).map((point, index) => (
                <Segment
                  key={`${point.label}-${index}`}
                  color={lineColor}
                  from={plottedPoints[index]}
                  to={point}
                />
              ))}

              {plottedPoints.length === 1 ? <Dot color={lineColor} point={plottedPoints[0]} size={10} /> : null}
              {plottedPoints.length > 1 ? (
                <>
                  <Dot color={lineColor} point={plottedPoints[0]} size={7} />
                  <Dot color={lineColor} point={plottedPoints[plottedPoints.length - 1]} size={10} />
                </>
              ) : null}

              <View style={[styles.axisLabels, { left: AXIS_WIDTH, top: chartHeight - 18, width: plotWidth }]}>
                {axisLabels.map((label, index) => (
                  <Text
                    key={`${label}-${index}`}
                    numberOfLines={1}
                    style={[
                      styles.axisLabel,
                      {
                        color: label ? colors.textMuted : 'transparent',
                        textAlign: index === 0 ? 'left' : index === axisLabels.length - 1 ? 'right' : 'center',
                      },
                    ]}
                  >
                    {label || '-'}
                  </Text>
                ))}
              </View>
            </>
          ) : null}
        </View>
      ) : (
        <View style={[styles.empty, { height: chartHeight }]}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>{emptyLabel}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
  },
  description: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 4,
  },
  valueLabel: {
    flexShrink: 0,
    fontSize: 12,
    fontWeight: '900',
  },
  chart: {
    position: 'relative',
  },
  yTick: {
    fontSize: 10,
    fontWeight: '800',
    left: 0,
    position: 'absolute',
    width: AXIS_WIDTH - 8,
  },
  gridLine: {
    height: StyleSheet.hairlineWidth,
    position: 'absolute',
  },
  segment: {
    position: 'absolute',
  },
  dot: {
    borderWidth: 2,
    position: 'absolute',
  },
  axisLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    position: 'absolute',
  },
  axisLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
});
