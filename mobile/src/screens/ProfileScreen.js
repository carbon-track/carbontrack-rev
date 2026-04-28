import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '../components/FormControls';
import { authApi } from '../api/auth';
import useAuthStore from '../store/authStore';

export default function ProfileScreen() {
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

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>我的</Text>
      <Text style={styles.title}>{user?.username || 'CarbonTracker'}</Text>
      <Text style={styles.body}>{user?.email || '未提供邮箱'}</Text>
      <Text style={styles.points}>积分：{user?.points ?? 0}</Text>
      <PrimaryButton
        title="退出登录"
        onPress={() => Alert.alert('退出登录', '确认退出当前账号？', [
          { text: '取消', style: 'cancel' },
          { text: '退出', style: 'destructive', onPress: handleLogout },
        ])}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  eyebrow: {
    color: '#16a34a',
    fontSize: 14,
    fontWeight: '700',
  },
  title: {
    color: '#14532d',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 8,
  },
  body: {
    color: '#64748b',
    fontSize: 16,
    marginBottom: 12,
    marginTop: 8,
  },
  points: {
    color: '#334155',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 24,
  },
});
