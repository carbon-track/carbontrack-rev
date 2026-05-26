import { useState } from 'react';
import Taro, { useDidShow, useRouter } from '@tarojs/taro';
import { Button, Text, View } from '@tarojs/components';
import { carbonApi } from '../../api/carbon';
import { getErrorMessage } from '../../api/client';
import { formatDate, formatNumber, getRecordTitle, statusText } from '../../utils/format';
import './index.css';

export default function RecordDetailPage() {
  const router = useRouter();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const id = router.params?.id;
    if (!id) {
      setError('缺少记录 ID');
      return;
    }
    setLoading(true);
    setError('');
    try {
      setRecord(await carbonApi.getRecord(id));
    } catch (err) {
      setError(getErrorMessage(err, '记录详情加载失败'));
    } finally {
      setLoading(false);
    }
  };

  useDidShow(load);

  return (
    <View className="page detail-page">
      <View className="home-header">
        <Text className="page-title">记录详情</Text>
        <Button className="small-button" loading={loading} onClick={load}>刷新</Button>
      </View>
      {error ? <Text className="error">{error}</Text> : null}
      {record ? (
        <View className="detail-panel">
          <Text className="detail-title">{getRecordTitle(record)}</Text>
          <View className="detail-row"><Text>状态</Text><Text>{statusText(record.status)}</Text></View>
          <View className="detail-row"><Text>日期</Text><Text>{formatDate(record.date || record.created_at)}</Text></View>
          <View className="detail-row"><Text>数量</Text><Text>{formatNumber(record.amount || record.data, 2)} {record.unit || ''}</Text></View>
          <View className="detail-row"><Text>减碳</Text><Text>{formatNumber(record.carbon_saved, 2)} kg</Text></View>
          <View className="detail-row"><Text>积分</Text><Text>{formatNumber(record.points_earned || record.points)}</Text></View>
          {record.description || record.notes ? <Text className="detail-notes">{record.description || record.notes}</Text> : null}
        </View>
      ) : (
        <View className="empty">暂无详情</View>
      )}
      <Button className="button-ghost" onClick={() => Taro.navigateBack({ delta: 1 })}>返回</Button>
    </View>
  );
}
