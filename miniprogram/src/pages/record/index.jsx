import { useMemo, useState } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { Button, Image, Input, Picker, Text, Textarea, View } from '@tarojs/components';
import { carbonApi } from '../../api/carbon';
import { getErrorMessage } from '../../api/client';
import { getSession, redirectToLogin } from '../../store/session';
import { formatNumber } from '../../utils/format';
import './index.css';

const today = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function RecordPage() {
  const [activities, setActivities] = useState([]);
  const [activityIndex, setActivityIndex] = useState(0);
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState('');
  const [date, setDate] = useState(today());
  const [description, setDescription] = useState('');
  const [imagePath, setImagePath] = useState('');
  const [calculation, setCalculation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const selectedActivity = activities[activityIndex] || null;
  const activityNames = useMemo(() => (
    activities.map((item) => item.name_zh || item.name || item.name_en || `活动 ${item.id}`)
  ), [activities]);

  const loadActivities = async () => {
    if (!getSession().isAuthenticated) {
      redirectToLogin();
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await carbonApi.getActivityFactors();
      const nextActivities = result.activities || [];
      setActivities(nextActivities);
      if (nextActivities[0]?.unit) {
        setUnit(nextActivities[0].unit);
      }
    } catch (err) {
      setError(getErrorMessage(err, '活动因子加载失败'));
    } finally {
      setLoading(false);
    }
  };

  useDidShow(loadActivities);

  const handleActivityChange = (event) => {
    const nextIndex = Number(event.detail.value);
    setActivityIndex(nextIndex);
    setCalculation(null);
    if (activities[nextIndex]?.unit) {
      setUnit(activities[nextIndex].unit);
    }
  };

  const chooseImage = async () => {
    const result = await Taro.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
    });
    setImagePath(result.tempFiles?.[0]?.tempFilePath || '');
  };

  const validate = () => {
    if (!selectedActivity?.id) {
      return '请选择活动类型';
    }
    if (!amount || Number(amount) <= 0) {
      return '请输入有效数量';
    }
    if (!date) {
      return '请选择活动日期';
    }
    if (!imagePath) {
      return '请添加一张凭证图片';
    }
    return '';
  };

  const handleCalculate = async () => {
    if (!selectedActivity?.id || !amount) {
      setError('请选择活动并输入数量');
      return;
    }
    setLoading(true);
    setError('');
    try {
      setCalculation(await carbonApi.calculate({
        activityId: selectedActivity.id,
        amount,
        unit,
      }));
    } catch (err) {
      setError(getErrorMessage(err, '计算失败'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await carbonApi.submitRecord({
        activityId: selectedActivity.id,
        amount,
        unit,
        date,
        description,
        imagePath,
      });
      Taro.showToast({ title: '提交成功', icon: 'success' });
      setAmount('');
      setDescription('');
      setImagePath('');
      setCalculation(null);
      Taro.navigateTo({ url: '/pages/records/index' });
    } catch (err) {
      setError(getErrorMessage(err, '提交失败'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="page record-page">
      <Text className="page-title">提交低碳记录</Text>
      <Text className="muted">选择活动、填写数量并上传凭证图片。</Text>

      {error ? <Text className="error form-error">{error}</Text> : null}

      <View className="record-form">
        <Picker range={activityNames} value={activityIndex} onChange={handleActivityChange}>
          <View className="picker-field">{selectedActivity ? activityNames[activityIndex] : '选择活动类型'}</View>
        </Picker>
        <View className="amount-row">
          <Input className="field amount-input" type="digit" placeholder="数量" value={amount} onInput={(event) => setAmount(event.detail.value)} />
          <Input className="field unit-input" placeholder="单位" value={unit} onInput={(event) => setUnit(event.detail.value)} />
        </View>
        <Picker mode="date" value={date} end={today()} onChange={(event) => setDate(event.detail.value)}>
          <View className="picker-field">日期：{date}</View>
        </Picker>
        <Textarea className="textarea-field" placeholder="说明（可选）" value={description} onInput={(event) => setDescription(event.detail.value)} />
        <Button className="button-ghost" onClick={chooseImage}>{imagePath ? '更换凭证图片' : '选择凭证图片'}</Button>
        {imagePath ? <Image className="preview-image" src={imagePath} mode="aspectFill" /> : null}
        {calculation ? (
          <View className="calculation-box">
            <Text>预计减碳 {formatNumber(calculation.carbon_saved, 2)} kg</Text>
            <Text>预计获得 {formatNumber(calculation.points_earned)} 积分</Text>
          </View>
        ) : null}
        <Button className="button-ghost" loading={loading} onClick={handleCalculate}>计算减碳量</Button>
        <Button className="button-primary" loading={submitting} onClick={handleSubmit}>提交记录</Button>
      </View>
    </View>
  );
}
