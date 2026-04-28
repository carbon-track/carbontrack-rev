import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function StoreScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>商城</Text>
      <Text style={styles.title}>积分兑换功能待接入</Text>
      <Text style={styles.body}>阶段 3 将接入商品列表、分类、兑换和兑换记录。</Text>
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
