import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { PrimaryButton, SecondaryButton } from '../components/FormControls';
import {
  GlassListItemSurface,
  GlassPressable,
  GlassSurface,
  PageHeader,
  ScreenBackground,
  SegmentedControl,
} from '../components/Glass';
import { authApi } from '../api/auth';
import { rewardsApi } from '../api/rewards';
import ImageLightbox from '../components/ImageLightbox';
import useAuthStore from '../store/authStore';
import { languageOptions, useI18n } from '../i18n';
import { themeOptions, useTheme } from '../theme';

const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const formatNumber = (value) => numberFormatter.format(Number(value || 0));

const padDatePart = (value) => String(value).padStart(2, '0');
const todayString = (value = new Date()) => (
  `${value.getFullYear()}-${padDatePart(value.getMonth() + 1)}-${padDatePart(value.getDate())}`
);
const monthKey = (value) => `${value.getFullYear()}-${padDatePart(value.getMonth() + 1)}`;
const addMonths = (value, delta) => new Date(value.getFullYear(), value.getMonth() + delta, 1);
const isHttpUrl = (value) => typeof value === 'string' && /^https?:\/\//.test(value);
const displayDate = (value) => String(value || '').split(/[T ]/)[0] || '--';

const normalizeBadgeId = (value) => (value === undefined || value === null ? null : String(value));

const resolveBadgeImage = (badge = {}) => {
  const candidates = [
    badge.icon_presigned_url,
    badge.icon_url,
    badge.icon_thumbnail_url,
    badge.icon_thumbnail_presigned_url,
  ];
  return candidates.find(isHttpUrl) || null;
};

const badgeName = (badge, language, fallback) => {
  if (language === 'zh') {
    return badge?.name_zh || badge?.name || badge?.name_en || fallback;
  }
  return badge?.name_en || badge?.name || badge?.name_zh || fallback;
};

const badgeDescription = (badge, language) => {
  if (language === 'zh') {
    return badge?.description_zh || badge?.description || badge?.description_en || '';
  }
  return badge?.description_en || badge?.description || badge?.description_zh || '';
};

function MetricTile({ icon, label, value, hint }) {
  const { colors } = useTheme();
  return (
    <GlassListItemSurface style={styles.metricTile}>
      <View style={styles.metricLabelRow}>
        <Ionicons color={colors.primary} name={icon} size={17} />
        <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{label}</Text>
      </View>
      <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
      {hint ? <Text style={[styles.metricHint, { color: colors.textMuted }]}>{hint}</Text> : null}
    </GlassListItemSurface>
  );
}

function CheckinCalendarPanel({ data, loading, month, onMonthChange, onMakeup }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [selectedDate, setSelectedDate] = useState(todayString());
  const [calendarWidth, setCalendarWidth] = useState(0);
  const monthMotion = React.useRef(new Animated.Value(0)).current;
  const previousMonthKey = React.useRef(monthKey(month));
  const payload = data || {};
  const checkins = Array.isArray(payload.checkins) ? payload.checkins : [];
  const stats = payload.stats || {};
  const quota = payload.makeup_quota || {};
  const meta = payload.meta || {};
  const serverToday = meta.server_today || todayString();
  const checkinMap = useMemo(() => {
    const map = new Map();
    checkins.forEach((item) => {
      if (item?.date) {
        map.set(item.date, item);
      }
    });
    return map;
  }, [checkins]);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const cells = [
    ...Array.from({ length: firstDay }, (_, index) => ({ key: `blank-${index}`, blank: true })),
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const date = `${monthKey(month)}-${padDatePart(day)}`;
      return { key: date, day, date, checkin: checkinMap.get(date) };
    }),
  ];
  const selectedCheckin = selectedDate ? checkinMap.get(selectedDate) : null;
  const isFuture = selectedDate > serverToday;
  const remaining = quota.remaining ?? null;
  const canMakeup = Boolean(selectedDate && !selectedCheckin && !isFuture && Number(remaining) > 0);
  const currentMonthKey = monthKey(month);

  useEffect(() => {
    const previous = previousMonthKey.current;
    if (previous === currentMonthKey) {
      return;
    }
    const direction = currentMonthKey > previous ? 1 : -1;
    previousMonthKey.current = currentMonthKey;
    monthMotion.setValue(direction);
    Animated.timing(monthMotion, {
      duration: 240,
      easing: Easing.out(Easing.cubic),
      toValue: 0,
      useNativeDriver: true,
    }).start();
  }, [currentMonthKey]);

  const calendarTranslateX = monthMotion.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-(calendarWidth || 320) * 0.18, 0, (calendarWidth || 320) * 0.18],
  });
  const calendarOpacity = monthMotion.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [0.55, 1, 0.55],
  });

  return (
    <GlassSurface contentStyle={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleBox}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('profile.checkin.title')}</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>{t('profile.checkin.subtitle')}</Text>
        </View>
        {loading ? <ActivityIndicator color={colors.primary} /> : null}
      </View>

      <View style={styles.metricGrid}>
        <MetricTile
          icon="flame-outline"
          label={t('profile.checkin.currentStreak')}
          value={formatNumber(stats.current_streak)}
          hint={stats.active_today ? t('profile.checkin.todayChecked') : t('profile.checkin.todayMissing')}
        />
        <MetricTile
          icon="trophy-outline"
          label={t('profile.checkin.longestStreak')}
          value={formatNumber(stats.longest_streak)}
          hint={t('profile.checkin.totalDays', { count: formatNumber(stats.total_days) })}
        />
        <MetricTile
          icon="refresh-outline"
          label={t('profile.checkin.makeupQuota')}
          value={remaining ?? '--'}
          hint={t('profile.checkin.monthlyReset')}
        />
      </View>

      <View style={styles.monthNav}>
        <SecondaryButton title={t('profile.checkin.previousMonth')} onPress={() => onMonthChange(addMonths(month, -1))} />
        <Text style={[styles.monthTitle, { color: colors.text }]}>{monthKey(month)}</Text>
        <SecondaryButton title={t('profile.checkin.nextMonth')} onPress={() => onMonthChange(addMonths(month, 1))} />
      </View>

      <Animated.View
        onLayout={(event) => setCalendarWidth(event.nativeEvent.layout.width)}
        style={[
          styles.calendarAnimated,
          {
            opacity: calendarOpacity,
            transform: [{ translateX: calendarTranslateX }],
          },
        ]}
      >
        <View style={styles.weekGrid}>
          {['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map((key) => (
            <Text key={key} style={[styles.weekDay, { color: colors.textMuted }]}>{t(`profile.checkin.weekdays.${key}`)}</Text>
          ))}
        </View>
        <View style={styles.calendarGrid}>
          {cells.map((cell) => {
            if (cell.blank) {
              return <View key={cell.key} style={styles.emptyDayCell} />;
            }
            const selected = cell.date === selectedDate;
            const checked = Boolean(cell.checkin);
            const makeup = cell.checkin?.source === 'makeup';
            const checkedColor = makeup ? colors.warning : colors.primary;
            const checkedTextColor = colors.dark ? '#07130f' : '#ffffff';
            return (
              <GlassPressable
                key={cell.key}
                contentStyle={styles.dayCellContent}
                fallbackStyle={{
                  backgroundColor: checked ? checkedColor : colors.surfaceMuted,
                }}
                onPress={() => setSelectedDate(cell.date)}
                style={[
                  styles.dayCellSurface,
                  {
                    borderColor: selected ? colors.primary : colors.borderStrong,
                  },
                ]}
                tintColor={checked ? colors.primarySoft : colors.surfaceMuted}
                wrapperStyle={styles.dayCell}
              >
                <Text style={[styles.dayText, { color: checked ? checkedTextColor : colors.text }]}>{cell.day}</Text>
              </GlassPressable>
            );
          })}
        </View>
      </Animated.View>

      <GlassListItemSurface contentStyle={styles.selectedBox}>
        <Text style={[styles.selectedTitle, { color: colors.text }]}>
          {selectedDate ? t('profile.checkin.selectedDate', { date: selectedDate }) : t('profile.checkin.selectHint')}
        </Text>
        <Text style={[styles.selectedMeta, { color: colors.textMuted }]}>
          {selectedCheckin
            ? `${t('profile.checkin.statusChecked')} / ${selectedCheckin.source === 'makeup' ? t('profile.checkin.statusMakeup') : t('profile.checkin.statusRecord')}`
            : isFuture
              ? t('profile.checkin.statusFuture')
              : t('profile.checkin.statusMissing')}
        </Text>
        <PrimaryButton
          title={t('profile.checkin.makeupAction')}
          disabled={!canMakeup}
          onPress={() => onMakeup(selectedDate)}
          icon="add-circle-outline"
        />
        {!canMakeup ? (
          <Text style={[styles.selectedMeta, { color: colors.textMuted }]}>{t('profile.checkin.makeupHint')}</Text>
        ) : null}
      </GlassListItemSurface>
    </GlassSurface>
  );
}

function BadgeRow({ item, locked = false }) {
  const { resolvedLanguage, t } = useI18n();
  const { colors } = useTheme();
  const badge = item.badge || item;
  const imageUri = resolveBadgeImage(badge);
  const imageSource = imageUri ? { uri: imageUri, cache: 'force-cache' } : null;
  return (
    <GlassListItemSurface contentStyle={styles.badgeRowContent} style={styles.badgeRow}>
      <View style={[styles.badgeIcon, { backgroundColor: colors.surfaceStrong, borderColor: colors.borderStrong }]}>
        {imageSource ? (
          <ImageLightbox source={imageSource} uri={imageUri} style={styles.badgeImageButton} contentStyle={styles.badgeImageContent}>
            <Image resizeMode="contain" source={imageSource} style={[styles.badgeImage, locked ? styles.lockedImage : null]} />
          </ImageLightbox>
        ) : (
          <Ionicons color={locked ? colors.textMuted : colors.primary} name={locked ? 'lock-closed-outline' : 'ribbon-outline'} size={26} />
        )}
      </View>
      <View style={styles.badgeBody}>
        <Text numberOfLines={1} style={[styles.badgeTitle, { color: colors.text }]}>
          {badgeName(badge, resolvedLanguage, t('profile.badges.unnamed'))}
        </Text>
        <Text numberOfLines={2} style={[styles.badgeDescription, { color: colors.textMuted }]}>
          {badgeDescription(badge, resolvedLanguage) || t('profile.badges.noDescription')}
        </Text>
        {item.awardedAt ? (
          <Text style={[styles.badgeMeta, { color: colors.primary }]}>
            {t('profile.badges.awardedAt')}: {displayDate(item.awardedAt)}
          </Text>
        ) : null}
      </View>
    </GlassListItemSurface>
  );
}

function BadgesPanel({ badgesData, myBadgesData, loading }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const allBadges = Array.isArray(badgesData) ? badgesData : [];
  const myBadges = Array.isArray(myBadgesData) ? myBadgesData : [];

  const processed = useMemo(() => {
    const allById = new Map();
    allBadges.forEach((badge) => {
      const key = normalizeBadgeId(badge?.id ?? badge?.badge_id);
      if (key) {
        allById.set(key, badge);
      }
    });

    const latest = new Map();
    const timeline = [];
    myBadges.forEach((entry, index) => {
      const record = entry?.user_badge || entry;
      const badge = entry?.badge || record?.badge || null;
      const badgeId = normalizeBadgeId(record?.badge_id ?? badge?.id ?? entry?.badge_id);
      if (!badgeId) {
        return;
      }
      const awardedAt = record?.awarded_at || record?.created_at || record?.updated_at || '';
      const normalized = {
        id: `${badgeId}-${awardedAt || index}`,
        badgeId,
        badge: badge || allById.get(badgeId) || {},
        record,
        awardedAt,
      };
      timeline.push(normalized);
      const existing = latest.get(badgeId);
      if (!existing || String(awardedAt) > String(existing.awardedAt || '')) {
        latest.set(badgeId, normalized);
      }
    });

    const unlocked = Array.from(latest.values()).sort((a, b) => String(b.awardedAt || '').localeCompare(String(a.awardedAt || '')));
    const locked = allBadges.filter((badge) => {
      const key = normalizeBadgeId(badge?.id ?? badge?.badge_id);
      return key && !latest.has(key) && badge?.is_deleted !== true;
    });
    return {
      unlocked,
      locked,
      timeline: timeline.filter((item) => item.awardedAt).sort((a, b) => String(b.awardedAt).localeCompare(String(a.awardedAt))),
    };
  }, [allBadges, myBadges]);

  const total = allBadges.length;
  const unlockedCount = processed.unlocked.length;
  const completion = total > 0 ? Math.round((unlockedCount / total) * 100) : 0;
  const pointsFromBadges = processed.unlocked.reduce((sum, item) => (
    sum + Number(item.record?.points_earned ?? item.badge?.points ?? 0)
  ), 0);

  return (
    <GlassSurface contentStyle={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleBox}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('profile.badges.title')}</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>{t('profile.badges.subtitle')}</Text>
        </View>
        {loading ? <ActivityIndicator color={colors.primary} /> : null}
      </View>

      <View style={styles.metricGrid}>
        <MetricTile icon="ribbon-outline" label={t('profile.badges.total')} value={formatNumber(total)} />
        <MetricTile icon="sparkles-outline" label={t('profile.badges.unlocked')} value={formatNumber(unlockedCount)} hint={`+${formatNumber(pointsFromBadges)} ${t('units.points')}`} />
        <MetricTile icon="bar-chart-outline" label={t('profile.badges.completion')} value={`${completion}%`} />
      </View>

      <Text style={[styles.subsectionTitle, { color: colors.text }]}>{t('profile.badges.unlockedTitle')}</Text>
      {processed.unlocked.length ? (
        <View style={styles.badgeList}>
          {processed.unlocked.map((item) => <BadgeRow key={item.id} item={item} />)}
        </View>
      ) : (
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('profile.badges.unlockedEmpty')}</Text>
      )}

      <Text style={[styles.subsectionTitle, { color: colors.text }]}>{t('profile.badges.lockedTitle')}</Text>
      {processed.locked.length ? (
        <View style={styles.badgeList}>
          {processed.locked.map((badge) => <BadgeRow key={badge.id || badge.badge_id} item={badge} locked />)}
        </View>
      ) : (
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('profile.badges.lockedEmpty')}</Text>
      )}

      <Text style={[styles.subsectionTitle, { color: colors.text }]}>{t('profile.badges.timelineTitle')}</Text>
      {processed.timeline.length ? (
        <View style={styles.timelineList}>
          {processed.timeline.slice(0, 8).map((item) => (
            <View key={`timeline-${item.id}`} style={[styles.timelineRow, { borderColor: colors.borderStrong }]}>
              <Ionicons color={colors.primary} name="sparkles-outline" size={18} />
              <Text style={[styles.timelineText, { color: colors.textMuted }]}>
                {badgeName(item.badge, undefined, t('profile.badges.unnamed'))} / {displayDate(item.awardedAt)}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('profile.badges.timelineEmpty')}</Text>
      )}
    </GlassSurface>
  );
}

export default function ProfileScreen({ navigation }) {
  const { languageMode, setLanguageMode, t } = useI18n();
  const { colors, setThemeMode, themeMode } = useTheme();
  const [checkinMonth, setCheckinMonth] = useState(() => new Date());
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const checkinsQuery = useQuery({
    queryKey: ['mobile-profile-checkins', monthKey(checkinMonth)],
    queryFn: () => rewardsApi.getCheckins({ month: monthKey(checkinMonth) }),
  });
  const badgesQuery = useQuery({
    queryKey: ['mobile-profile-badges'],
    queryFn: rewardsApi.getBadges,
  });
  const myBadgesQuery = useQuery({
    queryKey: ['mobile-profile-my-badges'],
    queryFn: rewardsApi.getMyBadges,
  });

  const refreshing = checkinsQuery.isFetching || badgesQuery.isFetching || myBadgesQuery.isFetching;

  const refresh = () => {
    checkinsQuery.refetch();
    badgesQuery.refetch();
    myBadgesQuery.refetch();
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Local logout must still succeed if the server session endpoint fails.
    } finally {
      await logout();
    }
  };

  const showLogoutConfirm = () => {
    Alert.alert(t('profile.logoutTitle'), t('profile.logoutMessage'), [
      { text: t('profile.cancel'), style: 'cancel' },
      { text: t('profile.confirmLogout'), style: 'destructive', onPress: handleLogout },
    ]);
  };

  const navigateToMakeupRecord = (date) => {
    if (!date) {
      return;
    }
    navigation?.navigate?.('Record', { checkinDate: date });
  };

  const openSettings = (section) => {
    navigation?.navigate?.('ProfileSettings', { section });
  };

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <GlassSurface contentStyle={styles.profile}>
          <PageHeader eyebrow={t('profile.eyebrow')} title={user?.username || t('app.fallbackUser')} />
          <Text style={[styles.body, { color: colors.textMuted }]}>{user?.email || t('profile.emailMissing')}</Text>
          <Text style={[styles.points, { color: colors.text }]}>{t('profile.points', { points: formatNumber(user?.points ?? 0) })}</Text>
        </GlassSurface>

        <CheckinCalendarPanel
          data={checkinsQuery.data}
          loading={checkinsQuery.isLoading}
          month={checkinMonth}
          onMonthChange={setCheckinMonth}
          onMakeup={navigateToMakeupRecord}
        />

        <BadgesPanel
          badgesData={badgesQuery.data}
          myBadgesData={myBadgesQuery.data}
          loading={badgesQuery.isLoading || myBadgesQuery.isLoading}
        />

        <GlassSurface contentStyle={styles.settings}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('profile.account.title')}</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>{t('profile.account.subtitle')}</Text>
          <View style={styles.actionGrid}>
            <SecondaryButton icon="person-outline" onPress={() => openSettings('profile')} title={t('profile.account.profile')} />
            <SecondaryButton icon="notifications-outline" onPress={() => openSettings('notifications')} title={t('profile.account.notifications')} />
            <SecondaryButton icon="shield-checkmark-outline" onPress={() => openSettings('security')} title={t('profile.account.security')} />
            <SecondaryButton icon="finger-print-outline" onPress={() => openSettings('passkeys')} title={t('profile.account.passkeys')} />
          </View>
        </GlassSurface>

        <GlassSurface contentStyle={styles.settings}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('profile.appearance')}</Text>
          <View style={styles.settingGroup}>
            <Text style={[styles.settingLabel, { color: colors.textMuted }]}>{t('profile.theme')}</Text>
            <SegmentedControl
              value={themeMode}
              onChange={setThemeMode}
              options={themeOptions.map((option) => ({ ...option, label: t(option.labelKey) }))}
            />
          </View>
          <View style={styles.settingGroup}>
            <Text style={[styles.settingLabel, { color: colors.textMuted }]}>{t('profile.language')}</Text>
            <SegmentedControl
              value={languageMode}
              onChange={setLanguageMode}
              options={languageOptions.map((option) => ({ ...option, label: t(option.labelKey) }))}
            />
          </View>
          <PrimaryButton title={t('profile.logout')} onPress={showLogoutConfirm} icon="log-out-outline" />
        </GlassSurface>
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 18,
    padding: 22,
    paddingBottom: 128,
  },
  profile: {
    gap: 8,
  },
  body: {
    fontSize: 16,
  },
  points: {
    fontSize: 16,
    fontWeight: '800',
  },
  section: {
    gap: 16,
  },
  sectionHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  sectionTitleBox: {
    flex: 1,
    minWidth: 0,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 4,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricTile: {
    borderRadius: 18,
    flexBasis: '30%',
    flexGrow: 1,
    minHeight: 104,
    padding: 13,
  },
  metricLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  metricLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '900',
    marginTop: 10,
  },
  metricHint: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
    marginTop: 4,
  },
  monthNav: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  monthTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  weekGrid: {
    flexDirection: 'row',
  },
  calendarAnimated: {
    gap: 8,
  },
  weekDay: {
    flex: 1,
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  dayCell: {
    aspectRatio: 1,
    width: `${(100 - 6 * 1.15) / 7}%`,
  },
  emptyDayCell: {
    aspectRatio: 1,
    width: `${(100 - 6 * 1.15) / 7}%`,
  },
  dayCellSurface: {
    borderRadius: 12,
    borderWidth: 1,
    height: '100%',
    width: '100%',
  },
  dayCellContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 12,
    fontWeight: '900',
    includeFontPadding: false,
    lineHeight: 16,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  selectedBox: {
    gap: 9,
    padding: 14,
  },
  selectedTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  selectedMeta: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    marginTop: 4,
  },
  badgeList: {
    gap: 10,
  },
  badgeRow: {
    borderRadius: 18,
  },
  badgeRowContent: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  badgeIcon: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 58,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 58,
  },
  badgeImage: {
    height: '100%',
    width: '100%',
  },
  badgeImageButton: {
    borderRadius: 999,
    height: '100%',
    width: '100%',
  },
  badgeImageContent: {
    height: '100%',
    width: '100%',
  },
  lockedImage: {
    opacity: 0.45,
  },
  badgeBody: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  badgeTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  badgeDescription: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  badgeMeta: {
    fontSize: 11,
    fontWeight: '800',
  },
  timelineList: {
    gap: 8,
  },
  timelineRow: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 8,
  },
  timelineText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  settings: {
    gap: 18,
  },
  actionGrid: {
    gap: 10,
  },
  settingGroup: {
    gap: 8,
  },
  settingLabel: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
