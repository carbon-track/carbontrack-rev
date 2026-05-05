import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
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
import {
  GlassListItemSurface,
  GlassPickerSurface,
  GlassPressable,
  GlassSurface,
  PageHeader,
  ScreenBackground,
} from '../components/Glass';
import { carbonApi } from '../api/carbon';
import ThermalReceiptCard from '../components/ThermalReceiptCard';
import { useI18n } from '../i18n';
import { useTheme } from '../theme';
import { getApiErrorMessage } from '../lib/apiError';

const { createReceiptFromSubmission } = require('../lib/thermalReceipt');

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

export default function RecordScreen({ navigation, route }) {
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
  const [submittedReceipt, setSubmittedReceipt] = useState(null);

  useEffect(() => {
    const requestedDate = route?.params?.checkinDate;
    if (!requestedDate) {
      return;
    }
    const normalizedDate = normalizeDateInput(requestedDate);
    if (isValidDateString(normalizedDate)) {
      setDate(normalizedDate);
    }
  }, [route?.params?.checkinDate]);

  const factorsQuery = useQuery({
    queryKey: ['mobile-carbon-activity-factors'],
    queryFn: carbonApi.getActivityFactors,
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
    onSuccess: (result, variables) => {
      setSubmittedReceipt(createReceiptFromSubmission({
        activity: selectedActivity,
        result,
        variables,
      }));
      setAmount('');
      setDescription('');
      setImage(null);
      setCalculation(result?.calculation || result);
      queryClient.invalidateQueries({ queryKey: ['mobile-carbon-records'] });
      queryClient.invalidateQueries({ queryKey: ['mobile-dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['mobile-dashboard-chart'] });
      queryClient.invalidateQueries({ queryKey: ['mobile-dashboard-activities'] });
    },
    onError: (error) => Alert.alert(t('record.submitFailed'), getApiErrorMessage(error, t('record.retryLater'))),
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
    const normalizedCheckinDate = route?.params?.checkinDate
      ? normalizeDateInput(route.params.checkinDate)
      : null;
    submitMutation.mutate({
      activityId,
      amount: parsedAmount,
      date: normalizedDate,
      checkinDate: normalizedCheckinDate && isValidDateString(normalizedCheckinDate)
        ? normalizedCheckinDate
        : null,
      description,
      image,
      unit: selectedActivity?.unit,
    });
  };

  const refreshing = factorsQuery.isFetching;

  const restartRecord = () => {
    setSubmittedReceipt(null);
    setActivityId('');
    setCalculation(null);
    setDate(route?.params?.checkinDate && isValidDateString(normalizeDateInput(route.params.checkinDate))
      ? normalizeDateInput(route.params.checkinDate)
      : todayString());
  };

  const goHome = () => {
    setSubmittedReceipt(null);
    navigation?.navigate?.('Home');
  };

  return (
    <ScreenBackground>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[styles.container, isWide ? styles.containerWide : null]}
          keyboardShouldPersistTaps="handled"
          refreshControl={(
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                factorsQuery.refetch();
              }}
              tintColor={colors.primary}
            />
          )}
        >
          <PageHeader eyebrow={t('record.eyebrow')} title={t('record.title')} subtitle={t('record.subtitle')} />

          {submittedReceipt ? (
            <ThermalReceiptCard
              receipt={submittedReceipt}
              onRestart={restartRecord}
              onGoHome={goHome}
            />
          ) : (
          <View style={[styles.grid, isWide ? styles.gridWide : null]}>
            <GlassSurface style={styles.gridItem} contentStyle={styles.form}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('record.newRecord')}</Text>

              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.text }]}>{t('record.activityType')}</Text>
                <GlassPickerSurface>
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
                </GlassPickerSurface>
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
                <GlassPressable
                  onPress={() => setDate(todayString())}
                  style={styles.todayButton}
                  contentStyle={styles.todayButtonContent}
                  wrapperStyle={styles.todayButtonWrapper}
                >
                  <Ionicons color={colors.primary} name="calendar-outline" size={17} />
                  <Text style={[styles.todayButtonText, { color: colors.text }]}>{t('record.useToday')}</Text>
                </GlassPressable>
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

              <GlassPressable
                onPress={pickImage}
                style={styles.imagePicker}
                contentStyle={styles.imagePickerContent}
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
              </GlassPressable>

              {calculation ? (
                <GlassListItemSurface contentStyle={styles.calculation} tintColor={colors.primarySoft}>
                  <Text style={[styles.calculationText, { color: colors.text }]}>
                    {t('record.calculatedCarbon', { value: formatNumber(calculation.carbon_saved), unit: t('units.kgCo2e') })}
                  </Text>
                  <Text style={[styles.calculationText, { color: colors.text }]}>
                    {t('record.calculatedPoints', { value: formatNumber(calculation.points_earned) })}
                  </Text>
                </GlassListItemSurface>
              ) : null}

              <View style={styles.actions}>
                <SecondaryButton title={t('record.calculate')} loading={calculateMutation.isPending} onPress={requestCalculation} icon="calculator-outline" />
                <PrimaryButton title={t('record.submit')} loading={submitMutation.isPending} onPress={submit} icon="cloud-upload-outline" />
              </View>
            </GlassSurface>

          </View>
          )}
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
    borderRadius: 16,
    height: 54,
    minHeight: 54,
  },
  todayButtonContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    height: 54,
    minHeight: 54,
    paddingHorizontal: 12,
  },
  todayButtonText: {
    fontSize: 13,
    fontWeight: '800',
  },
  todayButtonWrapper: {
    alignSelf: 'flex-end',
  },
  descriptionInput: {
    minHeight: 86,
    paddingTop: 12,
  },
  imagePicker: {
    borderRadius: 18,
    minHeight: 160,
  },
  imagePickerContent: {
    width: '100%',
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
});
