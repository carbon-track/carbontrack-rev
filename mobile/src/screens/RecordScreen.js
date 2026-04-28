import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function RecordScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>记录</Text>
      <Text style={styles.title}>碳记录功能待接入</Text>
      <Text style={styles.body}>阶段 2 将接入活动因子、图片上传和记录提交流程。</Text>
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
    fontSize: 26,
    fontWeight: '800',
    marginTop: 8,
  },
  body: {
    color: '#64748b',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 12,
  },
});
