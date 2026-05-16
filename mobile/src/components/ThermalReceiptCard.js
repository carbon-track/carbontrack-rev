import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton, SecondaryButton } from './FormControls';
import { GlassSurface } from './Glass';
import { makeShadow, useTheme } from '../theme';
import { useI18n } from '../i18n';
import { buildThermalReceiptSummary } from '../lib/thermalReceipt';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const textureLines = Array.from({ length: 26 }, (_, index) => index);
const paperSpeckles = Array.from({ length: 44 }, (_, index) => ({
  key: `speckle-${index}`,
  left: `${(index * 37) % 96}%`,
  opacity: 0.12 + ((index * 13) % 8) / 100,
  top: `${(index * 53) % 98}%`,
}));
const tearDots = Array.from({ length: 16 }, (_, index) => index);

function ReceiptTexture() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {textureLines.map((line) => (
        <View
          key={`line-${line}`}
          style={[
            styles.textureLine,
            {
              opacity: line % 3 === 0 ? 0.22 : 0.12,
              top: 30 + line * 19,
            },
          ]}
        />
      ))}
      {paperSpeckles.map((speckle) => (
        <View
          key={speckle.key}
          style={[
            styles.speckle,
            {
              left: speckle.left,
              opacity: speckle.opacity,
              top: speckle.top,
            },
          ]}
        />
      ))}
    </View>
  );
}

function ReceiptRow({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export default function ThermalReceiptCard({ onGoHome, onRestart, receipt }) {
  const { t, resolvedLanguage } = useI18n();
  const { colors } = useTheme();
  const [stageWidth, setStageWidth] = useState(0);
  const entry = useRef(new Animated.Value(0)).current;
  const scan = useRef(new Animated.Value(0)).current;
  const tiltX = useRef(new Animated.Value(0)).current;
  const tiltY = useRef(new Animated.Value(0)).current;

  const summary = useMemo(() => buildThermalReceiptSummary({
    language: resolvedLanguage,
    receipt,
    t,
  }), [receipt, resolvedLanguage, t]);

  const receiptWidth = stageWidth > 0
    ? Math.min(Math.max(stageWidth - 16, 1), 380)
    : 280;
  const scanTranslateY = scan.interpolate({
    inputRange: [0, 1],
    outputRange: [36, 540],
  });
  const receiptTransform = [
    { perspective: 1000 },
    {
      translateY: entry.interpolate({
        inputRange: [0, 1],
        outputRange: [-46, 0],
      }),
    },
    {
      rotateX: tiltY.interpolate({
        inputRange: [-1, 1],
        outputRange: ['7deg', '-7deg'],
      }),
    },
    {
      rotateY: tiltX.interpolate({
        inputRange: [-1, 1],
        outputRange: ['-8deg', '8deg'],
      }),
    },
    {
      scale: entry.interpolate({
        inputRange: [0, 1],
        outputRange: [0.96, 1],
      }),
    },
  ];

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => (
      Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4
    ),
    onPanResponderMove: (_, gestureState) => {
      tiltX.setValue(clamp(gestureState.dx / 120, -1, 1));
      tiltY.setValue(clamp(gestureState.dy / 140, -1, 1));
    },
    onPanResponderRelease: () => {
      Animated.parallel([
        Animated.spring(tiltX, {
          damping: 15,
          stiffness: 130,
          toValue: 0,
          useNativeDriver: true,
        }),
        Animated.spring(tiltY, {
          damping: 15,
          stiffness: 130,
          toValue: 0,
          useNativeDriver: true,
        }),
      ]).start();
    },
    onPanResponderTerminate: () => {
      Animated.parallel([
        Animated.spring(tiltX, {
          damping: 15,
          stiffness: 130,
          toValue: 0,
          useNativeDriver: true,
        }),
        Animated.spring(tiltY, {
          damping: 15,
          stiffness: 130,
          toValue: 0,
          useNativeDriver: true,
        }),
      ]).start();
    },
  })).current;

  useEffect(() => {
    entry.setValue(0);
    Animated.timing(entry, {
      duration: 620,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [entry, receipt?.record_id]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scan, {
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.delay(900),
        Animated.timing(scan, {
          duration: 0,
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scan, receipt?.record_id]);

  return (
    <GlassSurface contentStyle={styles.shell} style={styles.surface}>
      <View style={styles.successHeader}>
        <View style={[styles.iconBadge, { backgroundColor: colors.primarySoft }]}>
          <Ionicons color={colors.primary} name="checkmark-circle" size={28} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>{summary.successEyebrow}</Text>
          <Text style={[styles.title, { color: colors.text }]}>{summary.successTitle}</Text>
          <Text style={[styles.description, { color: colors.textMuted }]}>{summary.successDescription}</Text>
        </View>
      </View>

      <View
        onLayout={(event) => setStageWidth(event.nativeEvent.layout.width)}
        style={styles.stage}
        {...panResponder.panHandlers}
      >
        <View style={[styles.printerSlot, { width: receiptWidth * 0.72 }]}>
          <View style={styles.slotGlow} />
        </View>
        <Animated.View
          accessibilityLabel={`${summary.receiptTitle} ${summary.recordId}`}
          style={[
            styles.receiptDepth,
            makeShadow(colors, colors.dark ? 0.36 : 0.22, 18),
            {
              opacity: entry,
              transform: receiptTransform,
              width: receiptWidth,
            },
          ]}
        >
          <View style={styles.receiptPaper}>
            <ReceiptTexture />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.heatScan,
                {
                  transform: [{ translateY: scanTranslateY }],
                },
              ]}
            />
            <View style={styles.tearTop}>
              {tearDots.map((dot) => <View key={`tear-${dot}`} style={styles.tearDot} />)}
            </View>

            <View style={styles.receiptContent}>
              <View style={styles.receiptHeading}>
                <Text style={styles.brand}>CARBONTRACK</Text>
                <View style={styles.receiptMeta}>
                  <Text style={styles.receiptTitle}>{summary.receiptTitle}</Text>
                  <Text style={styles.recordId}>#{summary.recordId}</Text>
                </View>
              </View>

              <View style={styles.dashRule} />

              {summary.printLines.map((line) => (
                <ReceiptRow key={line.label} label={line.label} value={line.value} />
              ))}
              <ReceiptRow label={summary.labels.submittedAt} value={summary.submittedAt} />
              <ReceiptRow label={summary.labels.imageCount} value={summary.imageCount} />

              <View style={styles.boldRule} />

              <Text style={styles.blockLabel}>{summary.formulaLabel}</Text>
              <Text style={styles.formula}>{summary.formulaLine}</Text>

              <View style={styles.dashRule} />

              <Text style={styles.blockLabel}>{summary.descriptionLabel}</Text>
              <Text style={styles.note}>{summary.descriptionValue}</Text>

              <View style={styles.footerRule} />
              <Text style={styles.footerText}>{summary.footerLineOne}</Text>
              <Text style={styles.footerText}>{summary.footerLineTwo}</Text>
            </View>
          </View>
        </Animated.View>
      </View>

      <View style={styles.actions}>
        <PrimaryButton icon="refresh-outline" onPress={onRestart} title={summary.actions.restart} />
        <SecondaryButton icon="home-outline" onPress={onGoHome} title={summary.actions.home} />
      </View>
    </GlassSurface>
  );
}

const monoFont = Platform.select({
  android: 'monospace',
  ios: 'Menlo',
  default: 'monospace',
});

const styles = StyleSheet.create({
  actions: {
    gap: 10,
  },
  blockLabel: {
    color: '#746f63',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 7,
  },
  boldRule: {
    backgroundColor: '#282622',
    height: 2,
    marginBottom: 16,
    marginTop: 6,
  },
  brand: {
    color: '#12814f',
    fontFamily: monoFont,
    fontSize: 22,
    fontWeight: '900',
  },
  dashRule: {
    borderColor: '#302f2a',
    borderStyle: 'dashed',
    borderTopWidth: 1,
    marginVertical: 16,
  },
  description: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
  },
  footerRule: {
    backgroundColor: '#ded7c8',
    height: 1,
    marginBottom: 12,
    marginTop: 16,
  },
  footerText: {
    color: '#746f63',
    fontFamily: monoFont,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 18,
  },
  formula: {
    color: '#1f1d1a',
    fontFamily: monoFont,
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 22,
  },
  headerText: {
    flex: 1,
    gap: 5,
    minWidth: 0,
  },
  heatScan: {
    backgroundColor: 'rgba(18, 129, 79, 0.10)',
    height: 46,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1,
  },
  iconBadge: {
    alignItems: 'center',
    borderRadius: 18,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  note: {
    color: '#25231f',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
  },
  printerSlot: {
    alignItems: 'center',
    backgroundColor: '#dfe5de',
    borderColor: 'rgba(16, 35, 26, 0.10)',
    borderRadius: 999,
    borderWidth: 1,
    height: 18,
    justifyContent: 'center',
    marginBottom: -5,
    zIndex: 2,
  },
  receiptContent: {
    paddingBottom: 26,
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  receiptDepth: {
    borderRadius: 18,
  },
  receiptHeading: {
    gap: 8,
  },
  receiptMeta: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  receiptPaper: {
    backgroundColor: '#fffdf5',
    borderColor: '#ece4d4',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  receiptTitle: {
    color: '#746f63',
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
  },
  recordId: {
    color: '#746f63',
    fontFamily: monoFont,
    fontSize: 12,
    fontWeight: '900',
  },
  row: {
    gap: 5,
    marginBottom: 13,
  },
  rowLabel: {
    color: '#746f63',
    fontSize: 12,
    fontWeight: '800',
  },
  rowValue: {
    color: '#25231f',
    fontFamily: monoFont,
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 21,
  },
  shell: {
    gap: 18,
  },
  slotGlow: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 999,
    height: 4,
    width: '72%',
  },
  speckle: {
    backgroundColor: '#817b70',
    height: 2,
    position: 'absolute',
    width: 2,
  },
  stage: {
    alignItems: 'center',
    paddingBottom: 10,
    paddingTop: 6,
  },
  successHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 13,
  },
  surface: {
    borderRadius: 26,
  },
  tearDot: {
    backgroundColor: '#edf7f1',
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  tearTop: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginTop: -4,
  },
  textureLine: {
    backgroundColor: '#d8d0c1',
    height: 1,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  title: {
    fontSize: 25,
    fontWeight: '900',
    lineHeight: 31,
  },
});
