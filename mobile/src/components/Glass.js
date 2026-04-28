import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { makeShadow, useTheme } from '../theme';

const loadLiquidGlass = () => {
  try {
    const module = require('@callstack/liquid-glass');
    const supportedFlag = module?.isLiquidGlassSupported;
    const isSupported = typeof supportedFlag === 'function' ? supportedFlag() : Boolean(supportedFlag);
    if (module?.LiquidGlassContainerView && module?.LiquidGlassView && isSupported) {
      return {
        Container: module.LiquidGlassContainerView,
        Surface: module.LiquidGlassView,
        isAvailable: true,
      };
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('Liquid Glass native module unavailable; using fallback surface.', error);
    }
  }

  return {
    Container: View,
    Surface: View,
    isAvailable: false,
  };
};

const LiquidGlass = loadLiquidGlass();

export function ScreenBackground({ children, centered = false, style }) {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }, centered ? styles.centered : null, style]}>
      <View style={[styles.wash, { backgroundColor: colors.primarySoft }]} />
      <View style={[styles.washSecondary, { backgroundColor: colors.surfaceMuted }]} />
      {children}
    </SafeAreaView>
  );
}

export function GlassSurface({ children, style, contentStyle, intensity = 36 }) {
  const { colors, isDark } = useTheme();
  const glassEffect = intensity >= 42 ? 'regular' : 'clear';
  const Container = LiquidGlass.Container;
  const Surface = LiquidGlass.Surface;

  if (!LiquidGlass.isAvailable) {
    return (
      <Container style={[styles.glassShell, makeShadow(colors, isDark ? 0.32 : 0.14, 10), style]}>
        <Surface
          style={[
            styles.glassFill,
            { backgroundColor: colors.surface, borderColor: colors.border },
            contentStyle,
          ]}
        >
          {children}
        </Surface>
      </Container>
    );
  }

  return (
    <Container spacing={18} style={[styles.glassShell, makeShadow(colors, isDark ? 0.32 : 0.14, 10), style]}>
      <Surface
        interactive
        effect={glassEffect}
        colorScheme={isDark ? 'dark' : 'light'}
        tintColor={colors.surface}
        style={[
          styles.glassFill,
          { borderColor: colors.border },
          contentStyle,
        ]}
      >
        {children}
      </Surface>
    </Container>
  );
}

export function PageHeader({ eyebrow, title, subtitle, style }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.header, style]}>
      {eyebrow ? <Text style={[styles.eyebrow, { color: colors.primary }]}>{eyebrow}</Text> : null}
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
    </View>
  );
}

export function SegmentedControl({ options, value, onChange }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: colors.surfaceMuted, borderColor: colors.borderStrong }]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.segment, active ? { backgroundColor: colors.surfaceStrong } : null]}
          >
            <Text style={[styles.segmentText, { color: active ? colors.text : colors.textMuted }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    overflow: 'hidden',
  },
  centered: {
    justifyContent: 'center',
  },
  wash: {
    borderRadius: 180,
    height: 260,
    position: 'absolute',
    right: -90,
    top: -80,
    width: 260,
  },
  washSecondary: {
    borderRadius: 180,
    bottom: -120,
    height: 300,
    left: -120,
    position: 'absolute',
    width: 300,
  },
  glassShell: {
    borderRadius: 26,
    overflow: 'hidden',
  },
  glassFill: {
    borderRadius: 26,
    borderWidth: 1,
    padding: 18,
  },
  header: {
    gap: 8,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  segmented: {
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
  },
  segment: {
    alignItems: 'center',
    borderRadius: 14,
    flex: 1,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '800',
  },
});
