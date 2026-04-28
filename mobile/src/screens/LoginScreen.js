import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import TurnstileWidget from '../components/Turnstile';
import apiClient from '../api/client';
import useAuthStore from '../store/authStore';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState(null);
  const setToken = useAuthStore((state) => state.setToken);

  const handleLogin = async () => {
    if (!turnstileToken) return alert('请先完成人机验证');
    try {
      const res = await apiClient.post('/auth/login', { email, password, 'cf-turnstile-response': turnstileToken });
      setToken(res.data.token);
    } catch (err) {
      alert('登录失败: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>CarbonTrack 登录</Text>
      <TextInput placeholder="邮箱" style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" />
      <TextInput placeholder="密码" secureTextEntry style={styles.input} value={password} onChangeText={setPassword} />
      <TurnstileWidget onVerify={setTurnstileToken} />
      <Button title="登录" onPress={handleLogin} />
      <Button title="注册" onPress={() => navigation.navigate('Register')} color="#888" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 10, marginBottom: 15, borderRadius: 5 },
});