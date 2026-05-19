import React from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassSurface } from './Glass';
import { useI18n } from '../i18n';
import { makeShadow, useTheme } from '../theme';
import useProofOfWorkStore from '../store/proofOfWorkStore';

function ThinkingDots() {
  const { colors } = useTheme();
  const values = React.useRef([
    new Animated.Value(0.42),
    new Animated.Value(0.42),
    new Animated.Value(0.42),
  ]).current;

  React.useEffect(() => {
    const animations = values.map((value, index) => (
      Animated.sequence([
        Animated.delay(index * 130),
        Animated.timing(value, {
          duration: 240,
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          duration: 260,
          toValue: 0.42,
          useNativeDriver: true,
        }),
      ])
    ));
    const loop = Animated.loop(Animated.stagger(90, animations));
    loop.start();
    return () => loop.stop();
  }, [values]);

  return (
    <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {values.map((value, index) => (
        <Animated.View
          key={index}
          style={[
            styles.dot,
            {
              backgroundColor: colors.primary,
              opacity: value,
              transform: [{
                scale: value.interpolate({
                  inputRange: [0.42, 1],
                  outputRange: [0.78, 1.18],
                }),
              }],
            },
          ]}
        />
      ))}
    </View>
  );
}

export default function SecurityCheckIndicator() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const visible = useProofOfWorkStore((state) => state.activeCount > 0);
  const cancelAll = useProofOfWorkStore((state) => state.cancelAll);

  return (
    <Modal animationType="fade" onRequestClose={cancelAll} transparent visible={visible}>
      <View style={[styles.backdrop, { backgroundColor: colors.dark ? 'rgba(0, 0, 0, 0.46)' : 'rgba(16, 35, 26, 0.22)' }]}>
        <GlassSurface
          contentStyle={styles.cardContent}
          padded={false}
          style={[styles.card, { borderColor: colors.borderStrong }, makeShadow(colors, colors.dark ? 0.36 : 0.18, 16)]}
          tintColor={colors.primarySoft}
        >
          <View style={[styles.iconShell, { backgroundColor: colors.primarySoft }]}>
            <Ionicons color={colors.primary} name="shield-checkmark-outline" size={24} />
          </View>
          <View style={styles.textBlock}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: colors.text }]}>{t('securityCheck.title')}</Text>
              <ThinkingDots />
            </View>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t('securityCheck.subtitle')}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={cancelAll}
              style={({ pressed }) => [
                styles.cancelButton,
                { borderColor: colors.borderStrong, opacity: pressed ? 0.72 : 1 },
              ]}
            >
              <Text style={[styles.cancelText, { color: colors.primary }]}>{t('securityCheck.cancel')}</Text>
            </Pressable>
          </View>
        </GlassSurface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 22,
  },
  card: {
    borderRadius: 22,
    maxWidth: 360,
    width: '100%',
  },
  cardContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 13,
    padding: 18,
  },
  dot: {
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  cancelButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  cancelText: {
    fontSize: 12,
    fontWeight: '800',
  },
  dots: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    height: 20,
  },
  iconShell: {
    alignItems: 'center',
    borderRadius: 18,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  textBlock: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    includeFontPadding: false,
    lineHeight: 21,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
});
