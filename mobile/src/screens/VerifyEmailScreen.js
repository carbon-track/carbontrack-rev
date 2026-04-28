import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { Field, PrimaryButton, SecondaryButton } from '../components/FormControls';
import { GlassSurface, PageHeader, ScreenBackground } from '../components/Glass';
import TurnstileWidget, { isTurnstileConfigured } from '../components/Turnstile';
import { authApi } from '../api/auth';
import useAuthStore from '../store/authStore';
import { useI18n } from '../i18n';

export default function VerifyEmailScreen({ navigation, route }) {
  const { t } = useI18n();
  const initialEmail = route.params?.email || '';
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const setSession = useAuthStore((state) => state.setSession);
  const clearEmailVerificationRequired = useAuthStore((state) => state.clearEmailVerificationRequired);

  const resetTurnstile = () => {
    setTurnstileToken('');
    setTurnstileResetKey((value) => value + 1);
  };

  const handleSendCode = async () => {
    if (!email.trim() || (isTurnstileConfigured && !turnstileToken)) {
      Alert.alert(
        t('auth.sendFailed'),
        isTurnstileConfigured ? t('auth.sendEmailTurnstileRequired') : t('auth.sendEmailRequired'),
      );
      return;
    }
    setSending(true);
    try {
      const payload = {
        email: email.trim(),
      };
      if (turnstileToken) {
        payload.cf_turnstile_response = turnstileToken;
      }
      await authApi.sendVerificationCode(payload);
      resetTurnstile();
      Alert.alert(t('auth.sentTitle'), t('auth.sentMessage'));
    } catch (err) {
      resetTurnstile();
      Alert.alert(t('auth.sendFailed'), err.response?.data?.message || err.message || t('auth.retryLater'));
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    if (!email.trim() || !code.trim() || (isTurnstileConfigured && !turnstileToken)) {
      Alert.alert(
        t('auth.verifyFailed'),
        isTurnstileConfigured ? t('auth.verifyTurnstileMissing') : t('auth.verifyMissing'),
      );
      return;
    }
    setLoading(true);
    try {
      const payload = {
        email: email.trim(),
        code: code.trim(),
      };
      if (turnstileToken) {
        payload.cf_turnstile_response = turnstileToken;
      }
      const result = await authApi.verifyEmail(payload);
      if (!result.success) {
        throw new Error(result.message || t('auth.verifyFailed'));
      }
      if (result.data?.token && result.data?.user) {
        await setSession(result.data);
      }
      await clearEmailVerificationRequired();
      navigation.replace(useAuthStore.getState().isAuthenticated ? 'Main' : 'Login');
    } catch (err) {
      resetTurnstile();
      Alert.alert(t('auth.verifyFailed'), err.response?.data?.message || err.message || t('auth.retryLater'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenBackground>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <PageHeader title={t('auth.verifyTitle')} subtitle={t('auth.verifySubtitle')} style={styles.header} />
          <GlassSurface contentStyle={styles.form}>
            <Field label={t('auth.email')} placeholder={t('auth.emailPlaceholder')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
            <Field label={t('auth.code')} placeholder={t('auth.codePlaceholder')} value={code} onChangeText={setCode} autoCapitalize="none" />
            {isTurnstileConfigured ? (
              <TurnstileWidget
                resetKey={turnstileResetKey}
                onVerify={setTurnstileToken}
                onExpire={resetTurnstile}
                onError={resetTurnstile}
              />
            ) : null}
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
