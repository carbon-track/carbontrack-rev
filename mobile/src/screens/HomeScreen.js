import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { GlassSurface, PageHeader, ScreenBackground } from '../components/Glass';
import useAuthStore from '../store/authStore';
import { useI18n } from '../i18n';
import { useTheme } from '../theme';

export default function HomeScreen() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const user = useAuthStore((state) => state.user);
  const name = user?.username || t('app.fallbackUser');
  return (
    <ScreenBackground centered style={styles.container}>
      <GlassSurface contentStyle={styles.content}>
        <PageHeader eyebrow={t('home.eyebrow')} title={t('home.title', { name })} />
        <Text style={[styles.body, { color: colors.textMuted }]}>{t('home.body')}</Text>
      </GlassSurface>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 22,
  },
  content: {
    gap: 12,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
});
