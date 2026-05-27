import { useState } from 'react';
import Taro from '@tarojs/taro';
import { Button, Input, Text, View } from '@tarojs/components';
import { authApi } from '../../api/auth';
import { getErrorMessage } from '../../api/client';
import { setSession } from '../../store/session';
import './index.css';

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (loading) {
      return;
    }

    if (!identifier.trim() || !password) {
      setError('请输入账号和密码');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await authApi.login({
        identifier: identifier.trim(),
        password,
      });
      const data = result.data || {};
      setSession(data);
      if (data.email_verification_required) {
        Taro.navigateTo({ url: '/pages/verify-email/index' });
        return;
      }
      Taro.switchTab({ url: '/pages/home/index' });
    } catch (err) {
      setError(getErrorMessage(err, '登录失败，请检查账号密码'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="page login-page">
      <View className="auth-header">
        <Text className="eyebrow">CarbonTrack</Text>
        <Text className="auth-title">登录账号</Text>
        <Text className="auth-subtitle">使用现有 CarbonTrack 账号继续记录低碳行动。</Text>
      </View>

      <View className="auth-form">
        <Input
          className="field auth-input"
          placeholder="邮箱或用户名"
          value={identifier}
          onInput={(event) => setIdentifier(event.detail.value)}
        />
        <Input
          className="field auth-input"
          password
          placeholder="密码"
          value={password}
          onInput={(event) => setPassword(event.detail.value)}
        />
        {error ? <Text className="error">{error}</Text> : null}
        <Button className="button-primary" disabled={loading} loading={loading} onClick={handleLogin}>登录</Button>
        <Button className="button-ghost" onClick={() => Taro.navigateTo({ url: '/pages/register/index' })}>注册新账号</Button>
      </View>
    </View>
  );
}
