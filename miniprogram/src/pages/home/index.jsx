import { useState } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { Button, Text, View } from '@tarojs/components';
import { dashboardApi } from '../../api/dashboard';
import { getErrorMessage } from '../../api/client';
import { getSession, redirectToEmailVerification, redirectToLogin } from '../../store/session';
import { formatDate, formatNumber, getRecordTitle, statusText } from '../../utils/format';
import './index.css';

export default function HomePage() {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const session = getSession();
    if (!session.isAuthenticated) {
      redirectToLogin();
      return;
    }
    if (session.requiresEmailVerification) {
      redirectToEmailVerification();
      return;
    }
    setUser(session.user);
    setLoading(true);
    setError('');
    try {
      const [statsResult, recent] = await Promise.all([
        dashboardApi.getStats(),
        dashboardApi.getRecentActivities({ limit: 5 }),
      ]);
      setStats(statsResult);
      setActivities(recent);
    } catch (err) {
      setError(getErrorMessage(err, '首页数据加载失败'));
    } finally {
      setLoading(false);
    }
  };

  useDidShow(load);

  const summary = stats?.summary || {};
  const raw = stats?.raw || {};

  return (
    <View className="page home-page">
      <View className="home-header">
        <View>
          <Text className="muted">你好，{user?.username || 'CarbonTracker'}</Text>
          <Text className="page-title">今日低碳概览</Text>
        </View>
        <Button className="small-button" onClick={load} loading={loading}>刷新</Button>
      </View>

      {error ? <Text className="error">{error}</Text> : null}

      <View className="metric-grid">
        <View className="metric-card">
          <Text className="metric-value">{formatNumber(summary.totalPoints)}</Text>
          <Text className="metric-label">当前积分</Text>
        </View>
        <View className="metric-card">
          <Text className="metric-value">{formatNumber(summary.carbonSaved, 2)}</Text>
          <Text className="metric-label">累计减碳 kg</Text>
        </View>
        <View className="metric-card">
          <Text className="metric-value">{formatNumber(summary.recordsCount)}</Text>
          <Text className="metric-label">提交记录</Text>
        </View>
        <View className="metric-card">
          <Text className="metric-value">{raw.rank || '-'}</Text>
          <Text className="metric-label">积分排名</Text>
        </View>
      </View>

      <View className="quick-row">
        <Button className="button-primary quick-button" onClick={() => Taro.switchTab({ url: '/pages/record/index' })}>新增记录</Button>
        <Button className="button-ghost quick-button" onClick={() => Taro.navigateTo({ url: '/pages/records/index' })}>记录列表</Button>
      </View>

      <View className="section-header">
        <Text className="section-title">近期记录</Text>
        <Text className="muted">{activities.length} 条</Text>
      </View>

      <View className="list">
        {activities.length === 0 ? (
          <View className="empty">还没有低碳记录</View>
        ) : activities.map((item) => (
          <View key={item.id} className="list-item" onClick={() => Taro.navigateTo({ url: `/pages/record-detail/index?id=${item.id}` })}>
            <View>
              <Text className="item-title">{getRecordTitle(item)}</Text>
              <Text className="item-meta">{formatDate(item.created_at)} · {statusText(item.status)}</Text>
            </View>
            <Text className="item-points">+{formatNumber(item.points_earned)} 分</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
