import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Field, PrimaryButton, SecondaryButton } from '../components/FormControls';
import { GlassSurface, PageHeader, ScreenBackground } from '../components/Glass';
import { carbonApi } from '../api/carbon';
import { useI18n } from '../i18n';
import { useTheme } from '../theme';

const padDatePart = (value) => String(value).padStart(2, '0');
const todayString = (value = new Date()) => (
  `${value.getFullYear()}-${padDatePart(value.getMonth() + 1)}-${padDatePart(value.getDate())}`
);
const formatNumber = (value) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(Number(value || 0));

const normalizeAmountInput = (value) => {
  const asciiValue = String(value || '')
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/[，。]/g, '.')
    .replace(/,/g, '.')
    .replace(/[^\d.]/g, '');
  const [whole, ...fractions] = asciiValue.split('.');
  const normalized = fractions.length ? `${whole}.${fractions.join('')}` : whole;
  return normalized.startsWith('.') ? `0${normalized}` : normalized;
};

const parsePositiveAmount = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const normalizeDateInput = (value) => {
  const digits = String(value || '').replace(/[^\d]/g, '').slice(0, 8);
  if (digits.length <= 4) {
    return digits;
  }
  if (digits.length <= 6) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
};

const isValidDateString = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dateValue = new Date(year, month - 1, day);
  return (
    dateValue.getFullYear() === year
    && dateValue.getMonth() === month - 1
    && dateValue.getDate() === day
  );
};

const getActivityName = (item, language) => {
  if (language === 'zh') {
    return item.name_zh || item.name_en || item.combined_name || item.category || '';
  }
  return item.name_en || item.name_zh || item.combined_name || item.category || '';
};

const getRecordName = (item, language) => {
  if (language === 'zh') {
    return item.activity_name_zh || item.activity_name_en || item.category || '';
  }
  return item.activity_name_en || item.activity_name_zh || item.category || '';
};

const statusKey = (status) => {
  if (status === 'approved' || status === 'pending' || status === 'rejected') {
    return `record.status.${status}`;
  }
  return 'record.status.unknown';
};

function HistoryRow({ item, onPress }) {
  const { t, resolvedLanguage } = useI18n();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.historyRow,
        { backgroundColor: colors.surfaceMuted, borderColor: colors.borderStrong },
        pressed ? { opacity: 0.78 } : null,
      ]}
    >
      <View style={styles.historyMain}>
        <Text numberOfLines={1} style={[styles.historyTitle, { color: colors.text }]}>
          {getRecordName(item, resolvedLanguage) || t('record.activityFallback')}
        </Text>
        <Text style={[styles.historyMeta, { color: colors.textMuted }]}>
          {t(statusKey(item.status))} / {item.date || item.created_at || ''}
        </Text>
      </View>
      <View style={styles.historyMetrics}>
        <Text style={[styles.historyCarbon, { color: colors.primary }]}>
          {formatNumber(item.carbon_saved)} {t('units.kgCo2e')}
        </Text>
        <Text style={[styles.historyPoints, { color: colors.textMuted }]}>
          +{formatNumber(item.points_earned)} {t('units.points')}
        </Text>
      </View>
      <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
    </Pressable>
  );
}

export default function RecordScreen({ navigation }) {
  const { t, resolvedLanguage } = useI18n();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const queryClient = useQueryClient();
  const isWide = width >= 720;

  const [activityId, setActivityId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayString());
  const [description, setDescription] = useState('');
  const [image, setImage] = useState(null);
  const [calculation, setCalculation] = useState(null);

  const factorsQuery = useQuery({
    queryKey: ['mobile-carbon-activity-factors'],
    queryFn: carbonApi.getActivityFactors,
  });
  const historyQuery = useQuery({
    queryKey: ['mobile-carbon-records', 1],
    queryFn: () => carbonApi.getRecords({ page: 1, limit: 20 }),
  });

  const activities = factorsQuery.data?.activities || [];
  const selectedActivity = useMemo(
    () => activities.find((activity) => String(activity.id) === String(activityId)),
    [activities, activityId],
  );

  const calculateMutation = useMutation({
    mutationFn: carbonApi.calculate,
    onSuccess: setCalculation,
    onError: () => Alert.alert(t('record.calculateFailed'), t('record.retryLater')),
  });

  const submitMutation = useMutation({
    mutationFn: carbonApi.submitRecord,
    onSuccess: (result) => {
      setAmount('');
      setDescription('');
      setImage(null);
      setCalculation(result?.calculation || result);
      queryClient.invalidateQueries({ queryKey: ['mobile-carbon-records'] });
      queryClient.invalidateQueries({ queryKey: ['mobile-dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['mobile-dashboard-chart'] });
      queryClient.invalidateQueries({ queryKey: ['mobile-dashboard-activities'] });
      Alert.alert(t('record.submitSuccessTitle'), t('record.submitSuccessMessage'));
    },
    onError: () => Alert.alert(t('record.submitFailed'), t('record.retryLater')),
  });

  const requestCalculation = () => {
    const parsedAmount = parsePositiveAmount(amount);
    if (!activityId) {
      Alert.alert(t('record.calculateFailed'), t('record.missingCalculationFields'));
      return;
    }
    if (parsedAmount === null) {
      Alert.alert(t('record.calculateFailed'), t('record.invalidAmount'));
      return;
    }
    calculateMutation.mutate({ activityId, amount: parsedAmount, unit: selectedActivity?.unit });
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('record.photoPermissionTitle'), t('record.photoPermissionMessage'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.82,
    });
    if (!result.canceled && result.assets?.[0]) {
      setImage(result.assets[0]);
    }
  };

  const submit = () => {
    const parsedAmount = parsePositiveAmount(amount);
    const normalizedDate = normalizeDateInput(date);
    if (!activityId || !normalizedDate || !image) {
      Alert.alert(t('record.submitFailed'), t('record.missingSubmitFields'));
      return;
    }
    if (parsedAmount === null) {
      Alert.alert(t('record.submitFailed'), t('record.invalidAmount'));
      return;
    }
    if (!isValidDateString(normalizedDate)) {
      Alert.alert(t('record.submitFailed'), t('record.invalidDate'));
      return;
    }
    submitMutation.mutate({
      activityId,
      amount: parsedAmount,
      date: normalizedDate,
      description,
      image,
      unit: selectedActivity?.unit,
    });
  };

  const records = historyQuery.data?.records || [];
  const refreshing = factorsQuery.isFetching || historyQuery.isFetching;

  return (
    <ScreenBackground>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.container, isWide ? styles.containerWide : null]}
          keyboardShouldPersistTaps="handled"
          refreshControl={(
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                factorsQuery.refetch();
                historyQuery.refetch();
              }}
              tintColor={colors.primary}
            />
          )}
        >
          <PageHeader eyebrow={t('record.eyebrow')} title={t('record.title')} subtitle={t('record.subtitle')} />

          <View style={[styles.grid, isWide ? styles.gridWide : null]}>
            <GlassSurface style={styles.gridItem} contentStyle={styles.form}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('record.newRecord')}</Text>

              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.text }]}>{t('record.activityType')}</Text>
                <View style={[styles.pickerBox, { backgroundColor: colors.input, borderColor: colors.borderStrong }]}>
                  <Picker
                    dropdownIconColor={colors.text}
                    selectedValue={activityId}
                    onValueChange={(value) => {
                      setActivityId(value);
                      setCalculation(null);
                    }}
                    style={{ color: colors.text }}
                  >
                    <Picker.Item label={factorsQuery.isLoading ? t('record.loadingFactors') : t('record.activityPlaceholder')} value="" />
                    {activities.map((activity) => (
                      <Picker.Item
                        key={activity.id}
                        label={`${getActivityName(activity, resolvedLanguage)} (${activity.unit || t('record.unitFallback')})`}
                        value={String(activity.id)}
                      />
                    ))}
                  </Picker>
                </View>
              </View>

              <Field
                label={t('record.amount')}
                placeholder={selectedActivity?.unit ? t('record.amountPlaceholderWithUnit', { unit: selectedActivity.unit }) : t('record.amountPlaceholder')}
                value={amount}
                onChangeText={(value) => {
                  setAmount(normalizeAmountInput(value));
                  setCalculation(null);
                }}
                keyboardType="decimal-pad"
              />
              <View style={styles.dateRow}>
                <View style={styles.dateField}>
                  <Field
                    label={t('record.date')}
                    placeholder={t('record.datePlaceholder')}
                    value={date}
                    onChangeText={(value) => setDate(normalizeDateInput(value))}
                    keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
                  />
                </View>
                <Pressable
                  onPress={() => setDate(todayString())}
                  style={({ pressed }) => [
                    styles.todayButton,
                    { backgroundColor: colors.surfaceStrong, borderColor: colors.borderStrong },
                    pressed ? { opacity: 0.78 } : null,
                  ]}
                >
                  <Ionicons color={colors.primary} name="calendar-outline" size={17} />
                  <Text style={[styles.todayButtonText, { color: colors.text }]}>{t('record.useToday')}</Text>
                </Pressable>
              </View>
              <Field
                label={t('record.description')}
                placeholder={t('record.descriptionPlaceholder')}
                value={description}
                onChangeText={setDescription}
                multiline
                style={styles.descriptionInput}
                textAlignVertical="top"
              />

              <Pressable
                onPress={pickImage}
                style={({ pressed }) => [
                  styles.imagePicker,
                  { backgroundColor: colors.input, borderColor: colors.borderStrong },
                  pressed ? { opacity: 0.78 } : null,
                ]}
              >
                {image ? (
                  <Image source={{ uri: image.uri }} style={styles.previewImage} />
                ) : (
                  <View style={styles.imageEmpty}>
                    <Ionicons color={colors.primary} name="image-outline" size={26} />
                    <Text style={[styles.imageText, { color: colors.text }]}>{t('record.pickImage')}</Text>
                    <Text style={[styles.imageHint, { color: colors.textMuted }]}>{t('record.pickImageHint')}</Text>
                  </View>
                )}
              </Pressable>

              {calculation ? (
                <View style={[styles.calculation, { backgroundColor: colors.primarySoft }]}>
                  <Text style={[styles.calculationText, { color: colors.text }]}>
                    {t('record.calculatedCarbon', { value: formatNumber(calculation.carbon_saved), unit: t('units.kgCo2e') })}
                  </Text>
                  <Text style={[styles.calculationText, { color: colors.text }]}>
                    {t('record.calculatedPoints', { value: formatNumber(calculation.points_earned) })}
                  </Text>
                </View>
              ) : null}

              <View style={styles.actions}>
                <SecondaryButton title={t('record.calculate')} loading={calculateMutation.isPending} onPress={requestCalculation} icon="calculator-outline" />
                <PrimaryButton title={t('record.submit')} loading={submitMutation.isPending} onPress={submit} icon="cloud-upload-outline" />
              </View>
            </GlassSurface>

            <GlassSurface style={styles.gridItem} contentStyle={styles.historySection}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('record.history')}</Text>
                {historyQuery.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
              </View>
              {records.length ? (
                <View style={styles.historyList}>
                  {records.map((record) => (
                    <HistoryRow
                      key={record.id}
                      item={record}
                      onPress={() => navigation.navigate('RecordDetail', { id: record.id, record })}
                    />
                  ))}
                </View>
              ) : (
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('record.emptyHistory')}</Text>
              )}
            </GlassSurface>
          </View>
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
    gap: 18,
    padding: 20,
    paddingBottom: 128,
  },
  containerWide: {
    alignSelf: 'center',
    maxWidth: 1080,
    width: '100%',
  },
  grid: {
    gap: 16,
  },
  gridWide: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  gridItem: {
    flex: 1,
    minWidth: 0,
  },
  form: {
    gap: 14,
  },
  historySection: {
    gap: 14,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
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
  dateRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 10,
  },
  dateField: {
    flex: 1,
    minWidth: 0,
  },
  todayButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 50,
    paddingHorizontal: 12,
  },
  todayButtonText: {
    fontSize: 13,
    fontWeight: '800',
  },
  descriptionInput: {
    minHeight: 86,
    paddingTop: 12,
  },
  imagePicker: {
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 160,
    overflow: 'hidden',
  },
  previewImage: {
    aspectRatio: 1.7,
    width: '100%',
  },
  imageEmpty: {
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    minHeight: 160,
    padding: 20,
  },
  imageText: {
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  imageHint: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  calculation: {
    borderRadius: 16,
    gap: 6,
    padding: 14,
  },
  calculationText: {
    fontSize: 14,
    fontWeight: '800',
  },
  actions: {
    gap: 10,
  },
  historyList: {
    gap: 10,
  },
  historyRow: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 74,
    padding: 12,
  },
  historyMain: {
    flex: 1,
    minWidth: 0,
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  historyMeta: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  historyMetrics: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  historyCarbon: {
    fontSize: 13,
    fontWeight: '900',
  },
  historyPoints: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
});
