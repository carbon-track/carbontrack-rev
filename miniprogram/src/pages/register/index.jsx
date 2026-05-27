import { useState } from 'react';
import Taro from '@tarojs/taro';
import { Button, Input, Text, View } from '@tarojs/components';
import { authApi } from '../../api/auth';
import { getErrorMessage } from '../../api/client';
import { setSession } from '../../store/session';
import './index.css';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [countryCode, setCountryCode] = useState('CN');
  const [stateCode, setStateCode] = useState('BJ');
  const [schoolName, setSchoolName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validate = () => {
    if (!username.trim() || !email.trim() || !password || !confirmPassword) {
      return '请填写用户名、邮箱和密码';
    }
    if (password.length < 8) {
      return '密码至少需要 8 位';
    }
    if (password !== confirmPassword) {
      return '两次输入的密码不一致';
    }
    if (!countryCode.trim() || !stateCode.trim()) {
      return '请填写国家和州/省代码';
    }
    return '';
  };

  const handleRegister = async () => {
    if (loading) {
      return;
    }

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const payload = {
        username: username.trim(),
        email: email.trim(),
        password,
        confirm_password: confirmPassword,
        country_code: countryCode.trim().toUpperCase(),
        state_code: stateCode.trim().toUpperCase(),
      };
      if (schoolName.trim()) {
        payload.new_school_name = schoolName.trim();
      }

      const result = await authApi.register(payload);
      const data = result.data || {};
      setSession(data);
      if (data.email_verification_required) {
        Taro.redirectTo({ url: '/pages/verify-email/index' });
        return;
      }

      Taro.switchTab({ url: '/pages/home/index' });
    } catch (err) {
      setError(getErrorMessage(err, '注册失败，请稍后重试'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="page register-page">
      <View className="auth-header">
        <Text className="eyebrow">CarbonTrack</Text>
        <Text className="auth-title">注册账号</Text>
        <Text className="auth-subtitle">注册后会发送邮箱验证码，验证完成即可继续使用。</Text>
      </View>

      <View className="auth-form">
        <Input className="field auth-input" placeholder="用户名" value={username} onInput={(event) => setUsername(event.detail.value)} />
        <Input className="field auth-input" placeholder="邮箱" value={email} onInput={(event) => setEmail(event.detail.value)} />
        <Input className="field auth-input" password placeholder="密码，至少 8 位" value={password} onInput={(event) => setPassword(event.detail.value)} />
        <Input className="field auth-input" password placeholder="确认密码" value={confirmPassword} onInput={(event) => setConfirmPassword(event.detail.value)} />
        <View className="region-row">
          <Input className="field region-input" placeholder="国家代码" value={countryCode} onInput={(event) => setCountryCode(event.detail.value)} />
          <Input className="field region-input" placeholder="州/省代码" value={stateCode} onInput={(event) => setStateCode(event.detail.value)} />
        </View>
        <Input className="field auth-input" placeholder="学校名称（可选）" value={schoolName} onInput={(event) => setSchoolName(event.detail.value)} />
        {error ? <Text className="error">{error}</Text> : null}
        <Button className="button-primary" disabled={loading} loading={loading} onClick={handleRegister}>注册</Button>
        <Button className="button-ghost" onClick={() => Taro.navigateBack({ delta: 1 })}>返回登录</Button>
      </View>
    </View>
  );
}
