import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Field, PrimaryButton } from '../components/FormControls';
import TurnstileWidget from '../components/Turnstile';
import { authApi } from '../api/auth';
import useAuthStore from '../store/authStore';

export default function VerifyEmailScreen({ navigation, route }) {
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
    if (!email.trim() || !turnstileToken) {
      Alert.alert('发送失败', '请输入邮箱并完成人机验证');
      return;
    }
    setSending(true);
    try {
      await authApi.sendVerificationCode({
        email: email.trim(),
        cf_turnstile_response: turnstileToken,
      });
      resetTurnstile();
      Alert.alert('已发送', '验证码已发送至邮箱');
    } catch (err) {
      resetTurnstile();
      Alert.alert('发送失败', err.response?.data?.message || err.message || '请稍后重试');
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    if (!email.trim() || !code.trim() || !turnstileToken) {
      Alert.alert('验证失败', '请输入邮箱、验证码并完成人机验证');
      return;
    }
    setLoading(true);
    try {
      const result = await authApi.verifyEmail({
        email: email.trim(),
        code: code.trim(),
        cf_turnstile_response: turnstileToken,
      });
      if (!result.success) {
        throw new Error(result.message || '验证失败');
      }
      if (result.data?.token && result.data?.user) {
        await setSession(result.data);
      }
      clearEmailVerificationRequired();
      navigation.replace(useAuthStore.getState().isAuthenticated ? 'Main' : 'Login');
    } catch (err) {
      resetTurnstile();
      Alert.alert('验证失败', err.response?.data?.message || err.message || '请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>验证邮箱</Text>
        <Text style={styles.subtitle}>输入邮件中的验证码完成账号验证</Text>
        <View style={styles.form}>
          <Field label="邮箱" placeholder="name@example.com" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <Field label="验证码" placeholder="请输入验证码" value={code} onChangeText={setCode} autoCapitalize="none" />
          <TurnstileWidget
            resetKey={turnstileResetKey}
            onVerify={setTurnstileToken}
            onExpire={resetTurnstile}
            onError={resetTurnstile}
          />
          <PrimaryButton title="验证邮箱" loading={loading} onPress={handleVerify} />
          <PrimaryButton title="重新发送验证码" loading={sending} onPress={handleSendCode} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#14532d',
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: '#64748b',
    fontSize: 15,
    marginBottom: 24,
    marginTop: 8,
    textAlign: 'center',
  },
  form: {
    gap: 14,
  },
});
