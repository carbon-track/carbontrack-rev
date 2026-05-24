import { useState } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { Button, Text, View } from '@tarojs/components';
import { authApi } from '../../api/auth';
import { getErrorMessage } from '../../api/client';
import { profileApi } from '../../api/profile';
import { clearSession, getSession, redirectToLogin, setUser } from '../../store/session';
import { formatDate, formatNumber, statusText } from '../../utils/format';
import './index.css';

export default function ProfilePage() {
  const [user, setProfileUser] = useState(null);
  const [pointsHistory, setPointsHistory] = useState([]);
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const session = getSession();
    if (!session.isAuthenticated) {
      redirectToLogin();
      return;
    }
    setProfileUser(session.user);
    setLoading(true);
    setError('');
    try {
      const [me, history, nextBadges] = await Promise.all([
        profileApi.getMe(),
        profileApi.getPointsHistory({ limit: 10 }),
        profileApi.getBadges(),
      ]);
      setProfileUser(me);
      setUser(me);
      setPointsHistory(history.transactions);
      setBadges(nextBadges);
    } catch (err) {
      setError(getErrorMessage(err, '个人中心加载失败'));
    } finally {
      setLoading(false);
    }
  };

  useDidShow(load);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await authApi.logout();
    } catch {
      // 本地退出优先，服务端登出失败不阻断用户重新登录。
    } finally {
      clearSession();
      setLoading(false);
      Taro.reLaunch({ url: '/pages/login/index' });
    }
  };

  return (
    <View className="page profile-page">
      <View className="profile-card">
        <Text className="profile-name">{user?.username || 'CarbonTracker'}</Text>
        <Text className="muted">{user?.email || ''}</Text>
        <View className="profile-stats">
          <View>
            <Text className="metric-value">{formatNumber(user?.points)}</Text>
            <Text className="metric-label">积分</Text>
          </View>
          <View>
            <Text className="metric-value">{badges.length}</Text>
            <Text className="metric-label">徽章</Text>
          </View>
        </View>
      </View>

      {error ? <Text className="error">{error}</Text> : null}

      <View className="profile-actions">
        <Button className="button-ghost" loading={loading} onClick={load}>刷新资料</Button>
        <Button className="button-primary" onClick={() => Taro.navigateTo({ url: '/pages/records/index' })}>查看记录</Button>
      </View>

      <Text className="section-title profile-section">积分历史</Text>
      <View className="list">
        {pointsHistory.length === 0 ? (
          <View className="empty">暂无积分流水</View>
        ) : pointsHistory.map((item) => (
          <View key={item.id} className="list-item">
            <View>
              <Text className="item-title">{item.description || item.type || '积分变动'}</Text>
              <Text className="item-meta">{formatDate(item.created_at)} · {statusText(item.status)}</Text>
            </View>
            <Text className="item-points">{Number(item.points) >= 0 ? '+' : ''}{formatNumber(item.points)}</Text>
          </View>
        ))}
      </View>

      <Text className="section-title profile-section">徽章</Text>
      <View className="badge-list">
        {badges.length === 0 ? (
          <View className="empty">暂无徽章</View>
        ) : badges.map((badge) => (
          <View key={badge.id || badge.badge_id || badge.name} className="badge-item">
            <Text className="badge-name">{badge.name || badge.badge_name || '徽章'}</Text>
            <Text className="item-meta">{badge.description || badge.awarded_at || ''}</Text>
          </View>
        ))}
      </View>

      <Button className="logout-button" loading={loading} onClick={handleLogout}>退出登录</Button>
    </View>
  );
}
