const fs = require('fs');
const path = require('path');
const files = {
  'src/api/client.js': `
import axios from 'axios';
import useAuthStore from '../store/authStore';

const apiClient = axios.create({
  baseURL: 'https://api.carbontrack.com/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = 'Bearer ' + token;
  }
  return config;
});

export default apiClient;
  `,
  'src/store/authStore.js': `
import { create } from 'zustand';

const useAuthStore = create((set) => ({
  token: null,
  user: null,
  setToken: (token) => set({ token }),
  setUser: (user) => set({ user }),
  logout: () => set({ token: null, user: null }),
}));

export default useAuthStore;
  `,
  'src/components/Turnstile.js': `
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

const TURNSTILE_HTML = \\\`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
  <style>
    body, html { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: transparent; }
  </style>
</head>
<body>
  <div class="cf-turnstile" data-sitekey="0x4AAAAAAAMmPZbIuI1n_5sF" data-callback="onToken"></div>
  <script>
    function onToken(token) {
      window.ReactNativeWebView.postMessage(token);
    }
  </script>
</body>
</html>
\\\`;

export default function TurnstileWidget({ onVerify }) {
  return (
    <View style={styles.container}>
      <WebView
        source={{ html: TURNSTILE_HTML }}
        onMessage={(event) => onVerify(event.nativeEvent.data)}
        style={{ backgroundColor: 'transparent' }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 100,
    width: '100%',
    overflow: 'hidden',
  },
});
  `,
  'src/screens/LoginScreen.js': `
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
  `,
  'src/screens/RegisterScreen.js': `
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function RegisterScreen() {
  return (
    <View style={styles.container}>
      <Text>注册功能开发中...</Text>
    </View>
  );
}
const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', alignItems: 'center' } });
  `,
  'src/screens/HomeScreen.js': `
import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import useAuthStore from '../store/authStore';

export default function HomeScreen() {
  const logout = useAuthStore((state) => state.logout);
  return (
    <View style={styles.container}>
      <Text>欢迎来到 CarbonTrack</Text>
      <Button title="登出" onPress={logout} />
    </View>
  );
}
const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', alignItems: 'center' } });
  `,
  'src/navigation/AppNavigator.js': `
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import useAuthStore from '../store/authStore';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: '首页' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const token = useAuthStore((state) => state.token);

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {token ? (
          <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ title: '登录', headerShown: false }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ title: '注册' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
  `,
  'App.js': `
import React from 'react';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return <AppNavigator />;
}
  `
};
Object.entries(files).forEach(([file, content]) => {
  const fullPath = path.join(__dirname, file);
  if (!fs.existsSync(path.dirname(fullPath))) {
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  }
  fs.writeFileSync(fullPath, content.trim().replace(/\\\\`/g, '\`'));
});
console.log('Phase 1 files generated successfully.');
