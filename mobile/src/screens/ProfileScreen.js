import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '../components/FormControls';
import { GlassSurface, PageHeader, ScreenBackground, SegmentedControl } from '../components/Glass';
import { authApi } from '../api/auth';
import useAuthStore from '../store/authStore';
import { languageOptions, useI18n } from '../i18n';
import { themeOptions, useTheme } from '../theme';

export default function ProfileScreen() {
  const { languageMode, setLanguageMode, t } = useI18n();
  const { colors, setThemeMode, themeMode } = useTheme();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Local logout must still succeed if the server session endpoint fails.
    } finally {
      await logout();
    }
  };

  const showLogoutConfirm = () => {
    Alert.alert(t('profile.logoutTitle'), t('profile.logoutMessage'), [
      { text: t('profile.cancel'), style: 'cancel' },
      { text: t('profile.confirmLogout'), style: 'destructive', onPress: handleLogout },
    ]);
  };

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={styles.container}>
        <GlassSurface contentStyle={styles.profile}>
          <PageHeader eyebrow={t('profile.eyebrow')} title={user?.username || t('app.fallbackUser')} />
          <Text style={[styles.body, { color: colors.textMuted }]}>{user?.email || t('profile.emailMissing')}</Text>
          <Text style={[styles.points, { color: colors.text }]}>{t('profile.points', { points: user?.points ?? 0 })}</Text>
        </GlassSurface>

        <GlassSurface contentStyle={styles.settings}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('profile.appearance')}</Text>
          <View style={styles.settingGroup}>
            <Text style={[styles.settingLabel, { color: colors.textMuted }]}>{t('profile.theme')}</Text>
            <SegmentedControl
              value={themeMode}
              onChange={setThemeMode}
              options={themeOptions.map((option) => ({ ...option, label: t(option.labelKey) }))}
            />
          </View>
          <View style={styles.settingGroup}>
            <Text style={[styles.settingLabel, { color: colors.textMuted }]}>{t('profile.language')}</Text>
            <SegmentedControl
              value={languageMode}
              onChange={setLanguageMode}
              options={languageOptions.map((option) => ({ ...option, label: t(option.labelKey) }))}
            />
          </View>
          <PrimaryButton title={t('profile.logout')} onPress={showLogoutConfirm} icon="log-out-outline" />
        </GlassSurface>
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 18,
    padding: 22,
  },
  profile: {
    gap: 8,
  },
  body: {
    fontSize: 16,
  },
  points: {
    fontSize: 16,
    fontWeight: '800',
  },
  settings: {
    gap: 18,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
  },
  settingGroup: {
    gap: 8,
  },
  settingLabel: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
