import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { GlassSurface, PageHeader, ScreenBackground } from '../components/Glass';
import { useI18n } from '../i18n';
import { useTheme } from '../theme';

export default function RecordScreen() {
  const { t } = useI18n();
  const { colors } = useTheme();
  return (
    <ScreenBackground centered style={styles.container}>
      <GlassSurface contentStyle={styles.content}>
        <PageHeader eyebrow={t('record.eyebrow')} title={t('record.title')} />
        <Text style={[styles.body, { color: colors.textMuted }]}>{t('record.body')}</Text>
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
