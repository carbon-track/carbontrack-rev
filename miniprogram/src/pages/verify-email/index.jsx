import { useState } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { Button, Input, Text, View } from '@tarojs/components';
import { authApi } from '../../api/auth';
import { getErrorMessage } from '../../api/client';
import { clearEmailVerificationRequired, getSession, setSession } from '../../store/session';
import './index.css';

export default function VerifyEmailPage() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useDidShow(() => {
    const session = getSession();
    setEmail(session.verificationEmail || session.user?.email || '');
  });

  const handleSend = async () => {
    if (sending) {
      return;
    }

    if (!email.trim()) {
      setError('请先填写邮箱');
      return;
    }
    setSending(true);
    setError('');
    setMessage('');
    try {
      const result = await authApi.sendVerificationCode({ email: email.trim() });
      setMessage(result.message || '验证码已发送');
    } catch (err) {
      setError(getErrorMessage(err, '验证码发送失败'));
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    if (loading) {
      return;
    }

    if (!email.trim() || !code.trim()) {
      setError('请填写邮箱和验证码');
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const result = await authApi.verifyEmail({
        email: email.trim(),
        code: code.trim(),
      });
      if (result.data?.token) {
        setSession(result.data);
      }
      clearEmailVerificationRequired();
      Taro.switchTab({ url: '/pages/home/index' });
    } catch (err) {
      setError(getErrorMessage(err, '邮箱验证失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="page verify-page">
      <View className="auth-header">
        <Text className="eyebrow">Email</Text>
        <Text className="auth-title">验证邮箱</Text>
        <Text className="auth-subtitle">输入邮箱收到的验证码，完成账号验证。</Text>
      </View>
      <View className="auth-form">
        <Input className="field auth-input" placeholder="邮箱" value={email} onInput={(event) => setEmail(event.detail.value)} />
        <Input className="field auth-input" placeholder="验证码" value={code} onInput={(event) => setCode(event.detail.value)} />
        {message ? <Text className="success-text">{message}</Text> : null}
        {error ? <Text className="error">{error}</Text> : null}
        <Button className="button-ghost" disabled={sending} loading={sending} onClick={handleSend}>发送验证码</Button>
        <Button className="button-primary" disabled={loading} loading={loading} onClick={handleVerify}>完成验证</Button>
      </View>
    </View>
  );
}
