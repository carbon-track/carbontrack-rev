import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { Field, LinkButton, PrimaryButton, SecondaryButton } from '../components/FormControls';
import { GlassSurface, PageHeader, ScreenBackground } from '../components/Glass';
import { authApi } from '../api/auth';
import { passkeyApi } from '../api/passkey';
import { authenticateWithPasskey } from '../lib/passkey';
import useAuthStore from '../store/authStore';
import { useI18n } from '../i18n';

export default function LoginScreen({ navigation }) {
  const { t } = useI18n();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const setSession = useAuthStore((state) => state.setSession);

  const resolveError = (err, fallbackKey) => err.response?.data?.message || err.message || t(fallbackKey);

  const handleLogin = async () => {
    if (!identifier.trim() || !password) {
      Alert.alert(t('auth.loginFailed'), t('auth.loginMissingFields'));
      return;
    }
    setLoading(true);
    try {
      const payload = {
        identifier: identifier.trim(),
        password,
      };
      const result = await authApi.login(payload);
      if (!result.success) {
        throw new Error(result.message || t('auth.loginFailed'));
      }
      await setSession(result.data);
    } catch (err) {
      Alert.alert(t('auth.loginFailed'), resolveError(err, 'auth.retryLater'));
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    setPasskeyLoading(true);
    try {
      const optionsResult = await passkeyApi.getAuthenticationOptions(identifier.trim());
      const optionsData = optionsResult.data || {};
      const publicKey = optionsData.public_key || optionsData;
      const credential = await authenticateWithPasskey(publicKey);
      const result = await passkeyApi.login({
        challenge_id: optionsData.challenge_id,
        credential,
      });
      if (!result.success) {
        throw new Error(result.message || t('auth.passkeyFailed'));
      }
      await setSession(result.data);
    } catch (err) {
      if (err.message === 'PASSKEY_CANCELLED') {
        Alert.alert(t('auth.passkeyFailed'), t('auth.passkeyCancelled'));
      } else if (err.message === 'PASSKEY_UNAVAILABLE') {
        Alert.alert(t('auth.passkeyFailed'), t('auth.passkeyUnavailable'));
      } else {
        Alert.alert(t('auth.passkeyFailed'), resolveError(err, 'auth.retryLater'));
      }
    } finally {
      setPasskeyLoading(false);
    }
  };

  return (
    <ScreenBackground>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <PageHeader title={t('auth.loginTitle')} subtitle={t('auth.loginSubtitle')} style={styles.header} />

          <GlassSurface contentStyle={styles.form}>
            <Field
              label={t('auth.identifier')}
              placeholder={t('auth.identifierPlaceholder')}
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
            />
            <Field
              label={t('auth.password')}
              placeholder={t('auth.passwordPlaceholder')}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <PrimaryButton title={t('auth.login')} loading={loading} onPress={handleLogin} icon="log-in-outline" />
            <SecondaryButton
              title={t('auth.passkeyLogin')}
              loading={passkeyLoading}
              onPress={handlePasskeyLogin}
              icon="key-outline"
            />
            <LinkButton title={t('auth.needAccount')} onPress={() => navigation.navigate('Register')} />
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
