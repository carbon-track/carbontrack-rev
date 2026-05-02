import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { Field, PrimaryButton, SecondaryButton } from '../components/FormControls';
import { GlassSurface, PageHeader, ScreenBackground } from '../components/Glass';
import { authApi } from '../api/auth';
import useAuthStore from '../store/authStore';
import { useI18n } from '../i18n';

export default function VerifyEmailScreen({ route }) {
  const { t } = useI18n();
  const initialEmail = route.params?.email || '';
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const setSession = useAuthStore((state) => state.setSession);
  const clearEmailVerificationRequired = useAuthStore((state) => state.clearEmailVerificationRequired);

  const handleSendCode = async () => {
    if (!email.trim()) {
      Alert.alert(t('auth.sendFailed'), t('auth.sendEmailRequired'));
      return;
    }
    setSending(true);
    try {
      const payload = {
        email: email.trim(),
      };
      await authApi.sendVerificationCode(payload);
      Alert.alert(t('auth.sentTitle'), t('auth.sentMessage'));
    } catch (err) {
      Alert.alert(t('auth.sendFailed'), err.response?.data?.message || err.message || t('auth.retryLater'));
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    if (!email.trim() || !code.trim()) {
      Alert.alert(t('auth.verifyFailed'), t('auth.verifyMissing'));
      return;
    }
    setLoading(true);
    try {
      const payload = {
        email: email.trim(),
        code: code.trim(),
      };
      const result = await authApi.verifyEmail(payload);
      if (!result.success) {
        throw new Error(result.message || t('auth.verifyFailed'));
      }
      if (result.data?.token && result.data?.user) {
        await setSession(result.data);
      }
      await clearEmailVerificationRequired();
    } catch (err) {
      Alert.alert(t('auth.verifyFailed'), err.response?.data?.message || err.message || t('auth.retryLater'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenBackground>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <PageHeader title={t('auth.verifyTitle')} subtitle={t('auth.verifySubtitle')} style={styles.header} />
          <GlassSurface contentStyle={styles.form}>
            <Field label={t('auth.email')} placeholder={t('auth.emailPlaceholder')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
            <Field label={t('auth.code')} placeholder={t('auth.codePlaceholder')} value={code} onChangeText={setCode} autoCapitalize="none" />
            <PrimaryButton title={t('auth.verifyEmail')} loading={loading} onPress={handleVerify} icon="mail-open-outline" />
            <SecondaryButton title={t('auth.resendCode')} loading={sending} onPress={handleSendCode} icon="refresh-outline" />
          </GlassSurface>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 22,
  },
  header: {
    marginBottom: 18,
  },
  form: {
    gap: 14,
  },
});
