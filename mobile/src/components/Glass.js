import React from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { makeShadow, useTheme } from '../theme';
import { isNativeLiquidGlassEnabled } from '../lib/nativeFeatureFlags';

const AnimatedSafeAreaView = Animated.createAnimatedComponent(SafeAreaView);

const fallbackLiquidGlass = {
  Container: View,
  Surface: View,
  isSupported: false,
};
const liquidGlassEnabled = isNativeLiquidGlassEnabled();

const loadLiquidGlass = () => {
  if (!liquidGlassEnabled) {
    return fallbackLiquidGlass;
  }

  try {
    const module = require('@callstack/liquid-glass');
    return {
      Container: module?.LiquidGlassContainerView || View,
      Surface: module?.LiquidGlassView || View,
      isSupported: Boolean(module?.isLiquidGlassSupported),
    };
  } catch (error) {
    if (__DEV__) {
      console.warn('Liquid Glass native module unavailable; using fallback surfaces.', error);
    }
    return fallbackLiquidGlass;
  }
};

const LiquidGlass = loadLiquidGlass();

const glassTint = (colors, tintColor) => (
  tintColor || (colors.dark ? 'rgba(110, 231, 168, 0.10)' : 'rgba(18, 129, 79, 0.08)')
);

function GlassLayer({
  children,
  contentProps,
  contentStyle,
  effect = 'regular',
  fallbackStyle,
  interactive = false,
  style,
  tintColor,
}) {
  const { colors } = useTheme();
  const glassProps = LiquidGlass.isSupported
    ? {
        colorScheme: colors.dark ? 'dark' : 'light',
        effect,
        interactive,
        tintColor: glassTint(colors, tintColor),
      }
    : null;

  return (
    <LiquidGlass.Surface
      {...glassProps}
      style={[
        styles.glassBase,
        { borderColor: colors.border },
        !LiquidGlass.isSupported ? [{ backgroundColor: colors.surface }, fallbackStyle] : null,
        style,
      ]}
    >
      <View {...contentProps} style={contentStyle}>{children}</View>
    </LiquidGlass.Surface>
  );
}

export function ScreenBackground({ animatedStyle, children, centered = false, contentStyle, style, ...safeAreaProps }) {
  const { colors } = useTheme();
  return (
    <AnimatedSafeAreaView
      {...safeAreaProps}
      style={[
        styles.screen,
        { backgroundColor: colors.background },
        animatedStyle,
        style,
      ]}
    >
      <View pointerEvents="none" style={[styles.glowOne, { backgroundColor: colors.primarySoft }]} />
      <View pointerEvents="none" style={[styles.glowTwo, { backgroundColor: colors.surfaceStrong }]} />
      <Animated.View style={[styles.screenContent, centered ? styles.centered : null, contentStyle]}>
        {children}
      </Animated.View>
    </AnimatedSafeAreaView>
  );
}

export function GlassContainer({ children, spacing = 12, style }) {
  const containerProps = LiquidGlass.isSupported ? { spacing } : null;
  return (
    <LiquidGlass.Container {...containerProps} style={style}>
      {children}
    </LiquidGlass.Container>
  );
}

export function GlassSurface({
  children,
  contentStyle,
  effect = 'regular',
  interactive = false,
  padded = true,
  style,
  tintColor,
}) {
  const { colors } = useTheme();
  return (
    <GlassLayer
      contentStyle={contentStyle}
      effect={effect}
      fallbackStyle={{ backgroundColor: colors.surface }}
      interactive={interactive}
      style={[
        styles.surface,
        !padded ? styles.surfaceFlush : null,
        makeShadow(colors, colors.dark ? 0.28 : 0.12, 10),
        style,
      ]}
      tintColor={tintColor}
    >
      {children}
    </GlassLayer>
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

export function SegmentedControl({ value, onChange, options = [] }) {
  const { colors } = useTheme();
  const [trackWidth, setTrackWidth] = React.useState(0);
  const translateX = React.useRef(new Animated.Value(0)).current;
  const selectedIndex = Math.max(options.findIndex((option) => option.value === value), 0);
  const indicatorWidth = options.length && trackWidth > 0 ? (trackWidth - 8) / options.length : 0;

  React.useEffect(() => {
    if (!indicatorWidth) {
      return;
    }
    Animated.spring(translateX, {
      damping: 18,
      mass: 0.85,
      stiffness: 220,
      toValue: selectedIndex * indicatorWidth,
      useNativeDriver: true,
    }).start();
  }, [indicatorWidth, selectedIndex]);

  return (
    <GlassLayer
      contentProps={{
        onLayout: (event) => setTrackWidth(event.nativeEvent.layout.width),
      }}
      contentStyle={styles.segmentedContent}
      effect="clear"
      fallbackStyle={{ backgroundColor: colors.surfaceMuted }}
      style={styles.segmentedTrack}
      tintColor={colors.surfaceMuted}
    >
      {indicatorWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.segmentIndicator,
            {
              transform: [{ translateX }],
              width: indicatorWidth,
            },
          ]}
        >
          <GlassLayer
            effect="regular"
            fallbackStyle={{ backgroundColor: colors.primarySoft }}
            style={[styles.segmentIndicatorGlass, { borderColor: colors.primary }]}
            tintColor={colors.primarySoft}
          />
        </Animated.View>
      ) : null}
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segmentPressable,
              pressed ? { opacity: 0.78 } : null,
            ]}
          >
            <View style={styles.segmentOption}>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[
                  styles.segmentText,
                  { color: active ? colors.primary : colors.textMuted },
                ]}
              >
                {option.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </GlassLayer>
  );
}

export function GlassFieldSurface({ children, error, style }) {
  const { colors } = useTheme();
  return (
    <GlassLayer
      effect="regular"
      fallbackStyle={{ backgroundColor: colors.surfaceStrong }}
      style={[
        styles.fieldSurface,
        { borderColor: error ? colors.danger : colors.borderStrong },
        makeShadow(colors, colors.dark ? 0.16 : 0.08, 7),
        style,
      ]}
      tintColor={colors.input}
    >
      {children}
    </GlassLayer>
  );
}

export function GlassPickerSurface({ children, error, style }) {
  const { colors } = useTheme();
  return (
    <GlassLayer
      effect="clear"
      fallbackStyle={{ backgroundColor: colors.input }}
      style={[
        styles.pickerSurface,
        { borderColor: error ? colors.danger : colors.borderStrong },
        style,
      ]}
      tintColor={colors.primarySoft}
    >
      {children}
    </GlassLayer>
  );
}

export function GlassListItemSurface({ children, contentStyle, style, tintColor }) {
  const { colors } = useTheme();
  return (
    <GlassLayer
      contentStyle={contentStyle}
      effect="clear"
      fallbackStyle={{ backgroundColor: colors.surfaceMuted }}
      style={[styles.listItemSurface, { borderColor: colors.borderStrong }, style]}
      tintColor={tintColor || colors.primarySoft}
    >
      {children}
    </GlassLayer>
  );
}

export function GlassToggleSurface({ children, contentStyle, style }) {
  const { colors } = useTheme();
  return (
    <GlassLayer
      contentStyle={contentStyle}
      effect="clear"
      fallbackStyle={{ backgroundColor: colors.surfaceMuted }}
      style={[styles.toggleSurface, { borderColor: colors.borderStrong }, style]}
      tintColor={colors.primarySoft}
    >
      {children}
    </GlassLayer>
  );
}

export function GlassPressable({
  children,
  contentStyle,
  disabled,
  effect = 'clear',
  fallbackStyle,
  onPress,
  preserveGlassWhenDisabled = false,
  style,
  tintColor,
  wrapperStyle,
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pressableWrapper,
        wrapperStyle,
        pressed ? { opacity: 0.78 } : null,
        disabled && !preserveGlassWhenDisabled ? { opacity: 0.55 } : null,
      ]}
    >
      <GlassLayer
        contentStyle={contentStyle}
        effect={effect}
        fallbackStyle={fallbackStyle || { backgroundColor: colors.surfaceMuted }}
        interactive={!disabled}
        style={[styles.pressableSurface, style]}
        tintColor={tintColor}
      >
        {children}
      </GlassLayer>
    </Pressable>
  );
}

export function GlassButtonSurface({
  children,
  wrapperStyle,
  contentStyle,
  disabled,
  effect = 'clear',
  onPress,
  onPressIn,
  style,
  tintColor,
  variant = 'secondary',
  ...pressableProps
}) {
  const { colors } = useTheme();
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      disabled={disabled}
      {...pressableProps}
      style={({ pressed }) => [
        styles.pressableWrapper,
        wrapperStyle,
        pressed ? { opacity: 0.78 } : null,
        disabled ? { opacity: 0.55 } : null,
      ]}
    >
      <GlassLayer
        contentStyle={[styles.buttonContentSurface, contentStyle]}
        effect={effect}
        fallbackStyle={{ backgroundColor: primary ? colors.primarySoft : colors.surfaceStrong }}
        interactive={!disabled}
        style={[
          styles.buttonSurface,
          {
            borderColor: primary ? colors.primary : colors.borderStrong,
          },
          style,
        ]}
        tintColor={tintColor || (primary ? colors.primarySoft : colors.surfaceMuted)}
      >
        {children}
      </GlassLayer>
    </Pressable>
  );
}

export function FrostedBackButton({ accessibilityLabel = 'Back', onPress, wrapperStyle }) {
  const { colors } = useTheme();
  const tint = colors.dark ? 'rgba(5, 18, 12, 0.112)' : 'rgba(255, 255, 255, 0.098)';
  const borderColor = colors.dark ? 'rgba(210, 255, 226, 0.192)' : 'rgba(255, 255, 255, 0.576)';
  return (
    <GlassButtonSurface
      accessibilityLabel={accessibilityLabel}
      contentStyle={styles.frostedBackContent}
      effect="regular"
      onPress={onPress}
      style={[
        styles.frostedBackButton,
        { backgroundColor: tint, borderColor },
        makeShadow(colors, colors.dark ? 0.368 : 0.16, 11.2),
      ]}
      tintColor={tint}
      wrapperStyle={[styles.frostedBackWrapper, wrapperStyle]}
    >
      <Ionicons color={colors.text} name="chevron-back" size={25} />
    </GlassButtonSurface>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    overflow: 'hidden',
  },
  screenContent: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  frostedBackButton: {
    borderRadius: 24,
    borderWidth: 1.2,
    height: 48,
    minHeight: 48,
    overflow: 'hidden',
    paddingHorizontal: 0,
    width: 48,
  },
  frostedBackContent: {
    alignItems: 'center',
    flex: 0,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  frostedBackWrapper: {
    left: 16,
    position: 'absolute',
    top: 12,
    zIndex: 30,
  },
  glowOne: {
    borderRadius: 220,
    height: 320,
    opacity: 0.9,
    position: 'absolute',
    right: -140,
    top: -100,
    width: 320,
  },
  glowTwo: {
    borderRadius: 180,
    bottom: -120,
    height: 260,
    left: -100,
    opacity: 0.62,
    position: 'absolute',
    width: 260,
  },
  glassBase: {
    borderCurve: 'continuous',
    borderWidth: 1,
    overflow: 'hidden',
  },
  surface: {
    borderRadius: 24,
    padding: 18,
  },
  surfaceFlush: {
    padding: 0,
  },
  header: {
    gap: 7,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  segmentedTrack: {
    borderRadius: 20,
  },
  segmentedContent: {
    flexDirection: 'row',
    minHeight: 52,
    padding: 4,
    position: 'relative',
  },
  segmentIndicator: {
    bottom: 4,
    left: 4,
    position: 'absolute',
    top: 4,
    zIndex: 0,
  },
  segmentIndicatorGlass: {
    borderRadius: 16,
    height: '100%',
    width: '100%',
  },
  segmentPressable: {
    flex: 1,
    minWidth: 0,
    zIndex: 1,
  },
  segmentOption: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 10,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '900',
    includeFontPadding: false,
    lineHeight: 17,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  fieldSurface: {
    borderRadius: 18,
    minHeight: 54,
  },
  pickerSurface: {
    borderRadius: 16,
    minHeight: 50,
  },
  listItemSurface: {
    borderRadius: 18,
  },
  toggleSurface: {
    borderRadius: 18,
    padding: 12,
  },
  pressableWrapper: {
    alignSelf: 'stretch',
  },
  pressableSurface: {
    width: '100%',
  },
  buttonContentSurface: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  buttonSurface: {
    alignItems: 'center',
    borderRadius: 18,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
    width: '100%',
  },
});
