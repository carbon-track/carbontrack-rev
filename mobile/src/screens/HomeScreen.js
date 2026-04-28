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