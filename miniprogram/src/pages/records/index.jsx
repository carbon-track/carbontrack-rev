import { useState } from 'react';
import Taro, { useDidShow, useReachBottom } from '@tarojs/taro';
import { Button, Text, View } from '@tarojs/components';
import { carbonApi } from '../../api/carbon';
import { getErrorMessage } from '../../api/client';
import { getSession, redirectToEmailVerification, redirectToLogin } from '../../store/session';
import { formatDate, formatNumber, getRecordTitle, statusText } from '../../utils/format';
import './index.css';

export default function RecordsPage() {
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async (page = 1, { append = false } = {}) => {
    const session = getSession();
    if (!session.isAuthenticated) {
      redirectToLogin();
      return;
    }
    if (session.requiresEmailVerification) {
      redirectToEmailVerification();
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await carbonApi.getRecords({ page, limit: 20 });
      const nextRecords = result.records || [];
      setRecords((current) => (append ? [...current, ...nextRecords] : nextRecords));
      setPagination(result.pagination || { page, pages: 1, total: nextRecords.length });
    } catch (err) {
      setError(getErrorMessage(err, '记录列表加载失败'));
    } finally {
      setLoading(false);
    }
  };

  useDidShow(() => load(1));

  const hasMore = (pagination.page || 1) < (pagination.pages || 1);

  useReachBottom(() => {
    if (!loading && hasMore) {
      load((pagination.page || 1) + 1, { append: true });
    }
  });

  return (
    <View className="page records-page">
      <View className="home-header">
        <Text className="page-title">低碳记录</Text>
        <Button className="small-button" loading={loading} onClick={() => load(pagination.page || 1)}>刷新</Button>
      </View>
      {error ? <Text className="error">{error}</Text> : null}
      <View className="list">
        {records.length === 0 ? (
          <View className="empty">暂无记录</View>
        ) : records.map((item) => (
          <View key={item.id} className="list-item" onClick={() => Taro.navigateTo({ url: `/pages/record-detail/index?id=${item.id}` })}>
            <View>
              <Text className="item-title">{getRecordTitle(item)}</Text>
              <Text className="item-meta">{formatDate(item.created_at)} · {statusText(item.status)}</Text>
            </View>
            <View className="record-side">
              <Text className="item-points">+{formatNumber(item.points_earned || item.points)} 分</Text>
              <Text className="item-meta">{formatNumber(item.carbon_saved, 2)} kg</Text>
            </View>
          </View>
        ))}
      </View>
      {hasMore ? (
        <Button className="small-button" loading={loading} onClick={() => load((pagination.page || 1) + 1, { append: true })}>
          加载更多
        </Button>
      ) : null}
    </View>
  );
}
