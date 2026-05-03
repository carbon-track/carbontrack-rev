import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Field, PrimaryButton, SecondaryButton } from '../components/FormControls';
import {
  GlassButtonSurface,
  GlassListItemSurface,
  GlassPressable,
  GlassSurface,
  PageHeader,
  ScreenBackground,
  SegmentedControl,
} from '../components/Glass';
import RegionSelector from '../components/RegionSelector';
import { profileApi } from '../api/profile';
import { schoolApi } from '../api/schools';
import useAuthStore from '../store/authStore';
import { useI18n } from '../i18n';
import { useTheme } from '../theme';
import { registerWithPasskey } from '../lib/passkey';

const { validatePasswordDraft } = require('../lib/userContent');

const settingsSections = ['profile', 'notifications', 'security', 'passkeys'];
const securityTypes = ['all', 'sign_ins', 'passkey_changes', 'password_changes', 'logouts'];
const securityPeriods = ['all', '7d', '30d', '90d'];

const displayDateTime = (value) => String(value || '').replace('T', ' ').slice(0, 16) || '--';
const extractList = (payload, key) => {
  const source = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
  return Array.isArray(source) ? source : (source?.[key] || source?.items || source?.data || []);
};

const apiError = (error, fallback) => error?.response?.data?.message || error?.message || fallback;

function SectionPills({ active, onChange, options, prefix }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.pills}>
        {options.map((value) => (
          <GlassPressable
            key={value}
            onPress={() => onChange(value)}
            style={[styles.pill, active === value ? { borderColor: colors.primary } : null]}
          >
            <Text style={[styles.pillText, { color: active === value ? colors.primary : colors.text }]}>
              {t(`${prefix}.${value}`)}
            </Text>
          </GlassPressable>
        ))}
      </View>
    </ScrollView>
  );
}

function ProfileEditor({ user }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);
  const [countryCode, setCountryCode] = useState(user?.country_code || '');
  const [schoolQuery, setSchoolQuery] = useState(user?.school_name || '');
  const [selectedSchool, setSelectedSchool] = useState(user?.school_id ? { id: user.school_id, name: user.school_name || '' } : null);
  const [stateCode, setStateCode] = useState(user?.state_code || '');

  const schoolsQuery = useQuery({
    enabled: schoolQuery.trim().length > 1,
    queryFn: () => schoolApi.list({ search: schoolQuery.trim(), limit: 8, page: 1 }),
    queryKey: ['mobile-school-search', schoolQuery],
  });

  const updateMutation = useMutation({
    mutationFn: profileApi.updateProfile,
    onError: (error) => Alert.alert(t('profile.settings.saveFailed'), apiError(error, t('profile.settings.saveFailed'))),
    onSuccess: async (result) => {
      const nextUser = result?.user || result;
      if (nextUser?.id || nextUser?.email) {
        await setUser(nextUser);
      }
      queryClient.invalidateQueries({ queryKey: ['mobile-dashboard-stats'] });
      Alert.alert(t('profile.settings.saved'), t('profile.settings.savedMessage'));
    },
  });

  const save = () => {
    const payload = {};
    if (countryCode && stateCode) {
      payload.country_code = countryCode;
      payload.state_code = stateCode;
    }
    if (selectedSchool?.id) {
      payload.school_id = selectedSchool.id;
    } else if (schoolQuery.trim()) {
      payload.new_school_name = schoolQuery.trim();
    }
    updateMutation.mutate(payload);
  };

  const schools = extractList(schoolsQuery.data, 'schools');

  return (
    <GlassSurface contentStyle={styles.card}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('profile.settings.profileTitle')}</Text>
      <View style={styles.identityGrid}>
        <GlassListItemSurface contentStyle={styles.infoItem}>
          <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{t('profile.username')}</Text>
          <Text style={[styles.infoValue, { color: colors.text }]}>{user?.username || '--'}</Text>
        </GlassListItemSurface>
        <GlassListItemSurface contentStyle={styles.infoItem}>
          <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{t('profile.email')}</Text>
          <Text style={[styles.infoValue, { color: colors.text }]}>{user?.email || '--'}</Text>
        </GlassListItemSurface>
      </View>
      <RegionSelector
        countryCode={countryCode}
        onCountryChange={setCountryCode}
        onStateChange={setStateCode}
        stateCode={stateCode}
      />
      <Field
        label={t('profile.settings.school')}
        onChangeText={(value) => {
          setSchoolQuery(value);
          if (selectedSchool && selectedSchool.name !== value) {
            setSelectedSchool(null);
          }
        }}
        placeholder={t('profile.settings.schoolPlaceholder')}
        value={schoolQuery}
      />
      {schoolsQuery.isFetching ? <ActivityIndicator color={colors.primary} /> : null}
      {schools.length ? (
        <View style={styles.list}>
          {schools.map((school) => (
            <GlassPressable
              key={school.id}
              onPress={() => {
                setSelectedSchool(school);
                setSchoolQuery(school.name || '');
              }}
              style={[styles.schoolRow, selectedSchool?.id === school.id ? { borderColor: colors.primary } : null]}
            >
              <Text style={[styles.rowTitle, { color: colors.text }]}>{school.name}</Text>
            </GlassPressable>
          ))}
        </View>
      ) : null}
      <PrimaryButton loading={updateMutation.isPending} onPress={save} title={t('profile.settings.saveProfile')} />
    </GlassSurface>
  );
}

function PasswordEditor() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [newPassword, setNewPassword] = useState('');

  const mutation = useMutation({
    mutationFn: profileApi.changePassword,
    onError: (error) => Alert.alert(t('profile.security.passwordFailed'), apiError(error, t('profile.security.passwordFailed'))),
    onSuccess: () => {
      setConfirmPassword('');
      setCurrentPassword('');
      setNewPassword('');
      setErrors({});
      Alert.alert(t('profile.security.passwordSaved'), t('profile.security.passwordSavedMessage'));
    },
  });

  const submit = () => {
    const nextErrors = validatePasswordDraft({ confirmPassword, currentPassword, newPassword });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    mutation.mutate({
      confirm_new_password: confirmPassword,
      current_password: currentPassword,
      new_password: newPassword,
    });
  };

  return (
    <GlassSurface contentStyle={styles.card}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('profile.security.passwordTitle')}</Text>
      <Field error={errors.currentPassword ? t(errors.currentPassword) : null} label={t('profile.security.currentPassword')} onChangeText={setCurrentPassword} secureTextEntry value={currentPassword} />
      <Field error={errors.newPassword ? t(errors.newPassword) : null} label={t('profile.security.newPassword')} onChangeText={setNewPassword} secureTextEntry value={newPassword} />
      <Field error={errors.confirmPassword ? t(errors.confirmPassword) : null} label={t('profile.security.confirmPassword')} onChangeText={setConfirmPassword} secureTextEntry value={confirmPassword} />
      <PrimaryButton loading={mutation.isPending} onPress={submit} title={t('profile.security.changePassword')} />
    </GlassSurface>
  );
}

function NotificationSettings() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState([]);

  const prefsQuery = useQuery({
    queryFn: profileApi.getNotificationPreferences,
    queryKey: ['mobile-notification-preferences'],
  });

  React.useEffect(() => {
    if (prefsQuery.data) {
      setDraft(prefsQuery.data);
    }
  }, [prefsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: profileApi.updateNotificationPreferences,
    onError: (error) => Alert.alert(t('profile.notifications.saveFailed'), apiError(error, t('profile.notifications.saveFailed'))),
    onSuccess: (preferences) => {
      setDraft(preferences);
      queryClient.setQueryData(['mobile-notification-preferences'], preferences);
      Alert.alert(t('profile.notifications.saved'), t('profile.notifications.savedMessage'));
    },
  });

  const testMutation = useMutation({
    mutationFn: profileApi.sendNotificationTestEmail,
    onError: (error) => Alert.alert(t('profile.notifications.testFailed'), apiError(error, t('profile.notifications.testFailed'))),
    onSuccess: () => Alert.alert(t('profile.notifications.testSent'), t('profile.notifications.testSentMessage')),
  });

  const toggle = (category) => {
    setDraft((current) => current.map((item) => (
      item.category === category && !item.locked ? { ...item, enabled: !item.enabled } : item
    )));
  };

  return (
    <GlassSurface contentStyle={styles.card}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('profile.notifications.title')}</Text>
      {prefsQuery.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      <View style={styles.list}>
        {draft.map((item) => (
          <GlassListItemSurface key={item.category} contentStyle={styles.switchRow}>
            <View style={styles.rowTitleBox}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>{t(`profile.notifications.categories.${item.category}.label`)}</Text>
              <Text style={[styles.rowMeta, { color: colors.textMuted }]}>{t(`profile.notifications.categories.${item.category}.description`)}</Text>
            </View>
            <Switch
              disabled={item.locked}
              onValueChange={() => toggle(item.category)}
              thumbColor={item.enabled ? colors.primary : colors.textMuted}
              value={item.enabled}
            />
          </GlassListItemSurface>
        ))}
      </View>
      <View style={styles.actions}>
        <PrimaryButton loading={saveMutation.isPending} onPress={() => saveMutation.mutate(draft)} title={t('profile.notifications.save')} />
        {draft[0] ? (
          <SecondaryButton loading={testMutation.isPending} onPress={() => testMutation.mutate(draft[0].category)} title={t('profile.notifications.testEmail')} />
        ) : null}
      </View>
    </GlassSurface>
  );
}

function SecurityActivity() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [period, setPeriod] = useState('30d');
  const [type, setType] = useState('all');

  const query = useQuery({
    queryFn: () => profileApi.getSecurityActivity({ period, type, limit: 20 }),
    queryKey: ['mobile-security-activity', period, type],
  });

  const payload = query.data?.data && typeof query.data.data === 'object' ? query.data.data : query.data;
  const items = Array.isArray(payload?.items) ? payload.items : [];

  return (
    <GlassSurface contentStyle={styles.card}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('profile.security.activityTitle')}</Text>
      <SectionPills active={type} onChange={setType} options={securityTypes} prefix="profile.security.types" />
      <SectionPills active={period} onChange={setPeriod} options={securityPeriods} prefix="profile.security.periods" />
      {query.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      <View style={styles.list}>
        {items.length ? items.map((item, index) => (
          <GlassListItemSurface key={`${item.id || index}`} contentStyle={styles.activityRow}>
            <Ionicons color={colors.primary} name="shield-checkmark-outline" size={20} />
            <View style={styles.rowTitleBox}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>{item.action || item.event_type || item.type || t('profile.security.unknownActivity')}</Text>
              <Text style={[styles.rowMeta, { color: colors.textMuted }]}>{displayDateTime(item.created_at || item.createdAt)} / {item.ip_address || item.ip || '--'}</Text>
            </View>
          </GlassListItemSurface>
        )) : (
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('profile.security.emptyActivity')}</Text>
        )}
      </View>
    </GlassSurface>
  );
}

function PasskeySettings() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [labelDraft, setLabelDraft] = useState('');

  const query = useQuery({
    queryFn: profileApi.listPasskeys,
    queryKey: ['mobile-passkeys'],
  });
  const passkeys = extractList(query.data, 'passkeys');

  const registerMutation = useMutation({
    mutationFn: async () => {
      const options = await profileApi.getPasskeyRegistrationOptions();
      const data = options?.data && typeof options.data === 'object' ? options.data : options;
      const publicKey = data?.public_key || data?.publicKey || data;
      const credential = await registerWithPasskey(publicKey);
      return profileApi.registerPasskey({
        challenge_id: data?.challenge_id,
        credential,
        label: t('profile.passkeys.defaultLabel'),
      });
    },
    onError: (error) => {
      if (error?.message === 'PASSKEY_CANCELLED') {
        Alert.alert(t('profile.passkeys.registerFailed'), t('profile.passkeys.registerCancelled'));
        return;
      }
      Alert.alert(t('profile.passkeys.registerFailed'), apiError(error, t('profile.passkeys.registerFailed')));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mobile-passkeys'] });
      queryClient.invalidateQueries({ queryKey: ['mobile-security-activity'] });
      Alert.alert(t('profile.passkeys.registered'), t('profile.passkeys.registeredMessage'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, label }) => profileApi.updatePasskey(id, { label }),
    onError: (error) => Alert.alert(t('profile.passkeys.updateFailed'), apiError(error, t('profile.passkeys.updateFailed'))),
    onSuccess: () => {
      setEditingId(null);
      setLabelDraft('');
      queryClient.invalidateQueries({ queryKey: ['mobile-passkeys'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: profileApi.deletePasskey,
    onError: (error) => Alert.alert(t('profile.passkeys.deleteFailed'), apiError(error, t('profile.passkeys.deleteFailed'))),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mobile-passkeys'] }),
  });

  const confirmDelete = (id) => {
    Alert.alert(t('profile.passkeys.deleteTitle'), t('profile.passkeys.deleteMessage'), [
      { style: 'cancel', text: t('profile.cancel') },
      { onPress: () => deleteMutation.mutate(id), style: 'destructive', text: t('profile.passkeys.delete') },
    ]);
  };

  return (
    <GlassSurface contentStyle={styles.card}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('profile.passkeys.title')}</Text>
      <Text style={[styles.rowMeta, { color: colors.textMuted }]}>{t('profile.passkeys.registrationHint')}</Text>
      <PrimaryButton loading={registerMutation.isPending} onPress={() => registerMutation.mutate()} title={t('profile.passkeys.register')} />
      {query.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      <View style={styles.list}>
        {passkeys.length ? passkeys.map((passkey) => (
          <GlassListItemSurface key={passkey.id} contentStyle={styles.passkeyRow}>
            {editingId === passkey.id ? (
              <>
                <Field label={t('profile.passkeys.label')} onChangeText={setLabelDraft} value={labelDraft} />
                <View style={styles.actions}>
                  <PrimaryButton
                    loading={updateMutation.isPending}
                    onPress={() => updateMutation.mutate({ id: passkey.id, label: labelDraft })}
                    title={t('profile.passkeys.save')}
                  />
                  <SecondaryButton onPress={() => setEditingId(null)} title={t('profile.cancel')} />
                </View>
              </>
            ) : (
              <>
                <View style={styles.rowHeader}>
                  <Ionicons color={colors.primary} name="finger-print-outline" size={22} />
                  <View style={styles.rowTitleBox}>
                    <Text style={[styles.rowTitle, { color: colors.text }]}>{passkey.label || t('profile.passkeys.unnamed')}</Text>
                    <Text style={[styles.rowMeta, { color: colors.textMuted }]}>{t('profile.passkeys.lastUsed')}: {displayDateTime(passkey.last_used_at)}</Text>
                  </View>
                </View>
                <View style={styles.actions}>
                  <SecondaryButton onPress={() => { setEditingId(passkey.id); setLabelDraft(passkey.label || ''); }} title={t('profile.passkeys.edit')} />
                  <SecondaryButton onPress={() => confirmDelete(passkey.id)} title={t('profile.passkeys.delete')} />
                </View>
              </>
            )}
          </GlassListItemSurface>
        )) : (
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('profile.passkeys.empty')}</Text>
        )}
      </View>
    </GlassSurface>
  );
}

export default function ProfileSettingsScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const user = useAuthStore((state) => state.user);
  const [section, setSection] = useState(route?.params?.section || 'profile');
  const refreshQueries = useQueryClient();

  const refresh = () => {
    refreshQueries.invalidateQueries({ queryKey: ['mobile-notification-preferences'] });
    refreshQueries.invalidateQueries({ queryKey: ['mobile-security-activity'] });
    refreshQueries.invalidateQueries({ queryKey: ['mobile-passkeys'] });
  };

  return (
    <ScreenBackground>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.primary} />}
        >
          <GlassButtonSurface onPress={() => navigation?.goBack?.()} style={styles.backButton}>
            <Ionicons color={colors.primary} name="chevron-back" size={18} />
            <Text style={[styles.backText, { color: colors.primary }]}>{t('record.back')}</Text>
          </GlassButtonSurface>
          <PageHeader eyebrow={t('profile.settings.eyebrow')} title={t('profile.settings.title')} subtitle={t('profile.settings.subtitle')} />
          <SegmentedControl
            onChange={setSection}
            options={settingsSections.map((value) => ({ label: t(`profile.settings.sections.${value}`), value }))}
            value={section}
          />
          {section === 'profile' ? (
            <>
              <ProfileEditor user={user} />
              <PasswordEditor />
            </>
          ) : null}
          {section === 'notifications' ? <NotificationSettings /> : null}
          {section === 'security' ? <SecurityActivity /> : null}
          {section === 'passkeys' ? <PasskeySettings /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 10,
  },
  activityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 11,
    padding: 12,
  },
  backButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 5,
    minHeight: 38,
    paddingHorizontal: 12,
  },
  backText: {
    fontSize: 14,
    fontWeight: '900',
  },
  card: {
    gap: 14,
  },
  container: {
    gap: 16,
    padding: 18,
    paddingBottom: 110,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 21,
    textAlign: 'center',
  },
  flex: {
    flex: 1,
  },
  identityGrid: {
    gap: 10,
  },
  infoItem: {
    gap: 4,
    padding: 12,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '900',
  },
  list: {
    gap: 10,
  },
  passkeyRow: {
    gap: 12,
    padding: 12,
  },
  pill: {
    borderRadius: 999,
    minHeight: 38,
    paddingHorizontal: 14,
  },
  pills: {
    flexDirection: 'row',
    gap: 9,
    paddingRight: 12,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '900',
  },
  rowHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  rowMeta: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  rowTitleBox: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  schoolRow: {
    borderRadius: 16,
    padding: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  switchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
});
