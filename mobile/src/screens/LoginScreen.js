import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import TurnstileWidget from '../components/Turnstile';
import { Field, LinkButton, PrimaryButton } from '../components/FormControls';
import { authApi } from '../api/auth';
import useAuthStore from '../store/authStore';

export default function LoginScreen({ navigation }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const setSession = useAuthStore((state) => state.setSession);

  const resetTurnstile = () => {
    setTurnstileToken('');
    setTurnstileResetKey((value) => value + 1);
  };

  const handleLogin = async () => {
    if (!identifier.trim() || !password) {
      Alert.alert('登录失败', '请输入账号和密码');
      return;
    }
    if (!turnstileToken) {
      Alert.alert('登录失败', '请先完成人机验证');
      return;
    }

    setLoading(true);
    try {
      const result = await authApi.login({
        identifier: identifier.trim(),
        password,
        cf_turnstile_response: turnstileToken,
      });
      if (!result.success) {
        throw new Error(result.message || '登录失败');
      }
      await setSession(result.data);
      if (result.data?.email_verification_required) {
        navigation.navigate('VerifyEmail', { email: result.data.user?.email || identifier.trim() });
      }
    } catch (err) {
      resetTurnstile();
      Alert.alert('登录失败', err.response?.data?.message || err.message || '请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>CarbonTrack 登录</Text>
        <Text style={styles.subtitle}>使用邮箱或用户名继续低碳行动记录</Text>

        <View style={styles.form}>
          <Field
            label="用户名或邮箱"
            placeholder="请输入用户名或邮箱"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
          />
          <Field
            label="密码"
            placeholder="请输入密码"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <TurnstileWidget
            resetKey={turnstileResetKey}
            onVerify={setTurnstileToken}
            onExpire={resetTurnstile}
            onError={resetTurnstile}
          />
          <PrimaryButton title="登录" loading={loading} onPress={handleLogin} />
          <LinkButton title="还没有账号？注册" onPress={() => navigation.navigate('Register')} />
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
    marginBottom: 28,
    marginTop: 8,
    textAlign: 'center',
  },
  form: {
    gap: 14,
  },
});
