import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useQuery } from '@tanstack/react-query';
import { Field, LinkButton, PrimaryButton } from '../components/FormControls';
import RegionSelector from '../components/RegionSelector';
import TurnstileWidget, { isTurnstileConfigured } from '../components/Turnstile';
import { authApi } from '../api/auth';
import { schoolApi } from '../api/schools';
import useAuthStore from '../store/authStore';

export default function RegisterScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [useNewSchool, setUseNewSchool] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const setSession = useAuthStore((state) => state.setSession);

  const schoolsQuery = useQuery({
    queryKey: ['schools'],
    queryFn: async () => {
      const result = await schoolApi.list();
      return result.data?.schools || result.data || [];
    },
  });

  useEffect(() => {
    if (useNewSchool) {
      setSchoolId('');
    } else {
      setNewSchoolName('');
    }
  }, [useNewSchool]);

  const resetTurnstile = () => {
    setTurnstileToken('');
    setTurnstileResetKey((value) => value + 1);
  };

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
    if (!countryCode || !stateCode) {
      return '请选择国家和省 / 州';
    }
    if (useNewSchool && !newSchoolName.trim()) {
      return '请输入学校名称';
    }
    if (isTurnstileConfigured && !turnstileToken) {
      return '请先完成人机验证';
    }
    return '';
  };

  const handleRegister = async () => {
    const error = validate();
    if (error) {
      Alert.alert('注册失败', error);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        username: username.trim(),
        email: email.trim(),
        password,
        confirm_password: confirmPassword,
        country_code: countryCode,
        state_code: stateCode,
      };
      if (turnstileToken) {
        payload.cf_turnstile_response = turnstileToken;
      }
      if (schoolId) {
        payload.school_id = Number(schoolId);
      } else if (newSchoolName.trim()) {
        payload.new_school_name = newSchoolName.trim();
      }

      const result = await authApi.register(payload);
      if (!result.success) {
        throw new Error(result.message || '注册失败');
      }

      await setSession(result.data);
    } catch (err) {
      resetTurnstile();
      Alert.alert('注册失败', err.response?.data?.message || err.message || '请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const schools = schoolsQuery.data || [];

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>创建账号</Text>
        <Text style={styles.subtitle}>加入 CarbonTrack，开始记录低碳行动</Text>

        <View style={styles.form}>
          <Field label="用户名" placeholder="3-50 位字母、数字或下划线" value={username} onChangeText={setUsername} autoCapitalize="none" />
          <Field label="邮箱" placeholder="name@example.com" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <Field label="密码" placeholder="至少 8 位" value={password} onChangeText={setPassword} secureTextEntry />
          <Field label="确认密码" placeholder="再次输入密码" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />

          <RegionSelector
            countryCode={countryCode}
            stateCode={stateCode}
            onCountryChange={setCountryCode}
            onStateChange={setStateCode}
          />

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>找不到学校，创建新学校</Text>
            <Switch value={useNewSchool} onValueChange={setUseNewSchool} />
          </View>

          {useNewSchool ? (
            <Field label="学校名称" placeholder="请输入学校名称" value={newSchoolName} onChangeText={setNewSchoolName} />
          ) : (
            <View style={styles.field}>
              <Text style={styles.label}>学校</Text>
              <View style={styles.pickerBox}>
                <Picker selectedValue={schoolId} onValueChange={setSchoolId}>
                  <Picker.Item label={schoolsQuery.isLoading ? '加载学校中...' : '请选择学校（可选）'} value="" />
                  {schools.map((school) => (
                    <Picker.Item key={school.id} label={school.name} value={String(school.id)} />
                  ))}
                </Picker>
              </View>
            </View>
          )}

          {isTurnstileConfigured ? (
            <TurnstileWidget
              resetKey={turnstileResetKey}
              onVerify={setTurnstileToken}
              onExpire={resetTurnstile}
              onError={resetTurnstile}
            />
          ) : null}
          <PrimaryButton title="注册" loading={loading} onPress={handleRegister} />
          <LinkButton title="已有账号？登录" onPress={() => navigation.navigate('Login')} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    padding: 24,
  },
  title: {
    color: '#14532d',
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: '#64748b',
    fontSize: 15,
    marginBottom: 24,
    marginTop: 8,
    textAlign: 'center',
  },
  form: {
    gap: 14,
  },
  field: {
    gap: 6,
  },
  label: {
    color: '#14532d',
    fontSize: 14,
    fontWeight: '600',
  },
  pickerBox: {
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  switchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  switchLabel: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
  },
});
