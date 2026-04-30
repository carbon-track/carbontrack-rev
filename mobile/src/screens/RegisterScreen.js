import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useQuery } from '@tanstack/react-query';
import { Field, LinkButton, PrimaryButton } from '../components/FormControls';
import { GlassSurface, PageHeader, ScreenBackground } from '../components/Glass';
import RegionSelector from '../components/RegionSelector';
import { authApi } from '../api/auth';
import { schoolApi } from '../api/schools';
import useAuthStore from '../store/authStore';
import { useI18n } from '../i18n';
import { useTheme } from '../theme';

export default function RegisterScreen({ navigation }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [useNewSchool, setUseNewSchool] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState('');
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

  const validate = () => {
    if (!username.trim() || !email.trim() || !password || !confirmPassword) {
      return t('auth.registerMissingFields');
    }
    if (password.length < 8) {
      return t('auth.passwordTooShort');
    }
    if (password !== confirmPassword) {
      return t('auth.passwordMismatch');
    }
    if (!countryCode || !stateCode) {
      return t('auth.regionRequired');
    }
    if (useNewSchool && !newSchoolName.trim()) {
      return t('auth.schoolNameRequired');
    }
    return '';
  };

  const handleRegister = async () => {
    const error = validate();
    if (error) {
      Alert.alert(t('auth.registerFailed'), error);
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
      if (schoolId) {
        payload.school_id = Number(schoolId);
      } else if (newSchoolName.trim()) {
        payload.new_school_name = newSchoolName.trim();
      }

      const result = await authApi.register(payload);
      if (!result.success) {
        throw new Error(result.message || t('auth.registerFailed'));
      }

      await setSession(result.data);
    } catch (err) {
      Alert.alert(t('auth.registerFailed'), err.response?.data?.message || err.message || t('auth.retryLater'));
    } finally {
      setLoading(false);
    }
  };

  const schools = schoolsQuery.data || [];

  return (
    <ScreenBackground>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <PageHeader title={t('auth.registerTitle')} subtitle={t('auth.registerSubtitle')} style={styles.header} />

          <GlassSurface contentStyle={styles.form}>
            <Field label={t('auth.username')} placeholder={t('auth.usernamePlaceholder')} value={username} onChangeText={setUsername} autoCapitalize="none" />
            <Field label={t('auth.email')} placeholder={t('auth.emailPlaceholder')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
            <Field label={t('auth.password')} placeholder={t('auth.passwordMinPlaceholder')} value={password} onChangeText={setPassword} secureTextEntry />
            <Field label={t('auth.confirmPassword')} placeholder={t('auth.confirmPasswordPlaceholder')} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />

            <RegionSelector
              countryCode={countryCode}
              stateCode={stateCode}
              onCountryChange={setCountryCode}
              onStateChange={setStateCode}
            />

            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { color: colors.text }]}>{t('auth.createNewSchool')}</Text>
              <Switch
                value={useNewSchool}
                onValueChange={setUseNewSchool}
                trackColor={{ false: colors.borderStrong, true: colors.primarySoft }}
                thumbColor={useNewSchool ? colors.primary : colors.surfaceStrong}
              />
            </View>

            {useNewSchool ? (
              <Field label={t('auth.schoolName')} placeholder={t('auth.schoolNamePlaceholder')} value={newSchoolName} onChangeText={setNewSchoolName} />
            ) : (
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.text }]}>{t('auth.school')}</Text>
                <View style={[styles.pickerBox, { backgroundColor: colors.input, borderColor: colors.borderStrong }]}>
                  <Picker
                    dropdownIconColor={colors.text}
                    enabled={!schoolsQuery.isLoading}
                    selectedValue={schoolId}
                    onValueChange={setSchoolId}
                    style={{ color: colors.text }}
                  >
                    <Picker.Item label={schoolsQuery.isLoading ? t('auth.schoolLoading') : t('auth.schoolOptional')} value="" />
                    {schools.map((school) => (
                      <Picker.Item key={school.id} label={school.name} value={String(school.id)} />
                    ))}
                  </Picker>
                </View>
              </View>
            )}

            <PrimaryButton title={t('auth.register')} loading={loading} onPress={handleRegister} icon="person-add-outline" />
            <LinkButton title={t('auth.hasAccount')} onPress={() => navigation.navigate('Login')} />
          </GlassSurface>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    padding: 22,
    paddingBottom: 36,
  },
  header: {
    marginBottom: 18,
    marginTop: 18,
  },
  form: {
    gap: 14,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
  },
  pickerBox: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  switchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  switchLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
});
