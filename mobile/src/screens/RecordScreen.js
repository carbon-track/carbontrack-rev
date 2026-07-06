import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
import { buildSmartActivityDraft } from '../lib/smartActivity';
import { createReceiptFromSubmission } from '../lib/thermalReceipt';

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

const INTELLIGENCE_GRADIENT_COLORS = [
  'rgba(255, 55, 95, 0.96)',
  'rgba(255, 159, 10, 0.92)',
  'rgba(255, 214, 10, 0.88)',
  'rgba(50, 215, 75, 0.92)',
  'rgba(100, 210, 255, 0.96)',
  'rgba(10, 132, 255, 0.96)',
  'rgba(191, 90, 242, 0.92)',
  'rgba(255, 45, 85, 0.96)',
];

const INTELLIGENCE_GRADIENT_LOCATIONS = [0, 0.14, 0.28, 0.42, 0.58, 0.72, 0.86, 1];

function AppleIntelligenceGlow({ active }) {
  const wave = React.useRef(new Animated.Value(0)).current;
  const { width } = useWindowDimensions();
  const bandWidth = Math.max(620, Math.min(width * 1.7, 820));
  const horizontalDistance = Math.max(250, Math.min(width - 60, 470));
  const verticalDistance = 196;

  useEffect(() => {
    if (!active) {
      wave.stopAnimation();
      wave.setValue(0);
      return undefined;
    }

    const animation = Animated.loop(
      Animated.timing(wave, {
        duration: 2600,
        easing: Easing.linear,
        toValue: 1,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [active, wave]);

  const horizontal = wave.interpolate({
    inputRange: [0, 1],
    outputRange: [-bandWidth * 0.5, horizontalDistance],
  });
  const horizontalReverse = wave.interpolate({
    inputRange: [0, 1],
    outputRange: [horizontalDistance, -bandWidth * 0.5],
  });
  const vertical = wave.interpolate({
    inputRange: [0, 1],
    outputRange: [-bandWidth * 0.22, verticalDistance],
  });
  const verticalReverse = wave.interpolate({
    inputRange: [0, 1],
    outputRange: [verticalDistance, -bandWidth * 0.22],
  });
  const pulse = wave.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.78, 1, 0.78],
  });

  return (
    <View pointerEvents="none" style={[styles.aiGlowFrame, active ? styles.aiGlowFrameActive : null]}>
      <View style={styles.aiGlowSoftWash} />
      <View style={styles.aiGlowHairline} />
      <Animated.View style={[
        styles.aiGlowBandHorizontal,
        styles.aiGlowTop,
        { width: bandWidth, transform: [{ translateX: horizontal }, { scaleY: pulse }] },
      ]}>
        <LinearGradient
          colors={INTELLIGENCE_GRADIENT_COLORS}
          locations={INTELLIGENCE_GRADIENT_LOCATIONS}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.aiGlowGradientFill}
        />
      </Animated.View>
      <Animated.View style={[
        styles.aiGlowBandHorizontal,
        styles.aiGlowBottom,
        { width: bandWidth, transform: [{ translateX: horizontalReverse }, { scaleY: pulse }] },
      ]}>
        <LinearGradient
          colors={[...INTELLIGENCE_GRADIENT_COLORS].reverse()}
          locations={INTELLIGENCE_GRADIENT_LOCATIONS}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.aiGlowGradientFill}
        />
      </Animated.View>
      <Animated.View style={[
        styles.aiGlowBandVertical,
        styles.aiGlowLeft,
        { height: bandWidth * 0.62, transform: [{ translateY: vertical }, { scaleX: pulse }] },
      ]}>
        <LinearGradient
          colors={INTELLIGENCE_GRADIENT_COLORS}
          locations={INTELLIGENCE_GRADIENT_LOCATIONS}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.aiGlowGradientFill}
        />
      </Animated.View>
      <Animated.View style={[
        styles.aiGlowBandVertical,
        styles.aiGlowRight,
        { height: bandWidth * 0.62, transform: [{ translateY: verticalReverse }, { scaleX: pulse }] },
      ]}>
        <LinearGradient
          colors={[...INTELLIGENCE_GRADIENT_COLORS].reverse()}
          locations={INTELLIGENCE_GRADIENT_LOCATIONS}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.aiGlowGradientFill}
        />
      </Animated.View>
    </View>
  );
}

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
  const [smartQuery, setSmartQuery] = useState('');
  const [smartFillApplied, setSmartFillApplied] = useState(false);

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

  const smartFillMutation = useMutation({
    mutationFn: async (query) => {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const result = await carbonApi.suggestActivity(query, {
        client_time: new Date().toISOString(),
        client_timezone: timezone,
        entry: 'mobile-record-smart-fill',
      });
      if (result?.success === false) {
        throw new Error(result.error || t('record.smartFill.failedMessage'));
      }
      return result;
    },
    onSuccess: (result) => {
      const { activity, draft } = buildSmartActivityDraft(result?.prediction, activities);
      if (!activity || !draft) {
        const message = t('record.smartFill.notFound');
        Alert.alert(t('record.smartFill.failedTitle'), message);
        return;
      }

      setActivityId(draft.activityId);
      if (draft.amount) {
        setAmount(normalizeAmountInput(draft.amount));
      }
      if (draft.date && !route?.params?.checkinDate) {
        setDate(draft.date);
      }
      if (draft.description) {
        setDescription(draft.description);
      }
      setCalculation(null);
      setSmartQuery('');
      setSmartFillApplied(true);

      const parsedAmount = parsePositiveAmount(draft.amount);
      if (parsedAmount !== null) {
        calculateMutation.mutate({
          activityId: draft.activityId,
          amount: parsedAmount,
          unit: activity.unit || draft.unit,
        });
      }
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, t('record.smartFill.failedMessage'));
      Alert.alert(t('record.smartFill.failedTitle'), message);
    },
  });

  const requestSmartFill = () => {
    const query = smartQuery.trim();
    if (!query) {
      return;
    }
    setSmartFillApplied(false);
    smartFillMutation.mutate(query);
  };

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
      mediaTypes: ['images'],
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
    setSmartQuery('');
    setSmartFillApplied(false);
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

              <GlassListItemSurface
                contentStyle={styles.smartPanel}
                style={styles.smartPanelSurface}
                tintColor={colors.primarySoft}
              >
                <AppleIntelligenceGlow active={smartFillMutation.isPending} />
                <View style={styles.smartHeader}>
                  <View style={[styles.smartIcon, { backgroundColor: colors.primarySoft }]}>
                    <Ionicons color={colors.primary} name="sparkles-outline" size={18} />
                  </View>
                  <View style={styles.smartTitleBlock}>
                    <Text style={[styles.smartTitle, { color: colors.text }]}>{t('record.smartFill.title')}</Text>
                    <Text style={[styles.smartSubtitle, { color: colors.textMuted }]}>{t('record.smartFill.subtitle')}</Text>
                  </View>
                </View>
                <TextInput
                  editable={!smartFillMutation.isPending}
                  maxLength={500}
                  multiline
                  onChangeText={(value) => {
                    setSmartQuery(value);
                    setSmartFillApplied(false);
                  }}
                  placeholder={t('record.smartFill.placeholder')}
                  placeholderTextColor={colors.textMuted}
                  style={[
                    styles.smartInput,
                    {
                      backgroundColor: colors.input,
                      borderColor: colors.borderStrong,
                      color: colors.text,
                    },
                  ]}
                  textAlignVertical="top"
                  value={smartQuery}
                />
                <View style={styles.smartFooter}>
                  <Text style={[styles.smartCount, { color: colors.textMuted }]}>{smartQuery.length}/500</Text>
                  <GlassPressable
                    disabled={!smartQuery.trim() || smartFillMutation.isPending || factorsQuery.isLoading}
                    onPress={requestSmartFill}
                    style={[
                      styles.smartButton,
                      { borderColor: colors.primary },
                    ]}
                    contentStyle={styles.smartButtonContent}
                    tintColor={colors.primarySoft}
                  >
                    <View style={styles.smartButtonInner}>
                      <View style={styles.smartButtonIconSlot}>
                        <Ionicons color={colors.primary} name="color-wand-outline" size={18} />
                      </View>
                      <Text
                        numberOfLines={1}
                        style={[styles.smartButtonText, { color: colors.primary }]}
                      >
                        {smartFillMutation.isPending ? t('record.smartFill.analyzing') : t('record.smartFill.button')}
                      </Text>
                    </View>
                  </GlassPressable>
                </View>
                {smartFillApplied ? (
                  <Text
                    selectable
                    style={[styles.smartStatus, { color: colors.primary }]}
                  >
                    {t('record.smartFill.applied')}
                  </Text>
                ) : null}
              </GlassListItemSurface>

              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.text }]}>{t('record.activityType')}</Text>
                <GlassPickerSurface>
                  <Picker
                    dropdownIconColor={colors.text}
                    selectedValue={activityId}
                    onValueChange={(value) => {
                      setActivityId(value);
                      setCalculation(null);
                      setSmartFillApplied(false);
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
  smartPanelSurface: {
    borderRadius: 22,
    position: 'relative',
  },
  smartPanel: {
    gap: 12,
    padding: 14,
  },
  smartHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  smartIcon: {
    alignItems: 'center',
    borderRadius: 14,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  smartTitleBlock: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  smartTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  smartSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  smartInput: {
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 15,
    lineHeight: 21,
    minHeight: 88,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  smartFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  smartCount: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
  smartButton: {
    borderRadius: 18,
    minHeight: 44,
    minWidth: 154,
    overflow: 'hidden',
  },
  smartButtonContent: {
    flex: 0,
    minHeight: 44,
    paddingHorizontal: 18,
  },
  smartButtonInner: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 44,
  },
  smartButtonIconSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
  },
  smartButtonText: {
    fontSize: 14,
    fontWeight: '900',
    includeFontPadding: false,
    lineHeight: 18,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  smartStatus: {
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  aiGlowFrame: {
    borderCurve: 'continuous',
    borderRadius: 22,
    bottom: 0,
    left: 0,
    opacity: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
  },
  aiGlowFrameActive: {
    opacity: 1,
  },
  aiGlowHairline: {
    borderColor: 'rgba(255, 255, 255, 0.36)',
    borderCurve: 'continuous',
    borderRadius: 22,
    borderWidth: 1,
    bottom: 1,
    left: 1,
    position: 'absolute',
    right: 1,
    top: 1,
  },
  aiGlowSoftWash: {
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderCurve: 'continuous',
    borderRadius: 22,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  aiGlowGradientFill: {
    height: '100%',
    width: '100%',
  },
  aiGlowBandHorizontal: {
    borderRadius: 999,
    height: 16,
    opacity: 0.88,
    overflow: 'hidden',
    position: 'absolute',
  },
  aiGlowBandVertical: {
    borderRadius: 999,
    opacity: 0.88,
    overflow: 'hidden',
    position: 'absolute',
    width: 16,
  },
  aiGlowTop: {
    top: -5,
  },
  aiGlowBottom: {
    bottom: -5,
  },
  aiGlowLeft: {
    left: -5,
  },
  aiGlowRight: {
    right: -5,
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
