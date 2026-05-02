import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
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
import ImageLightbox from '../components/ImageLightbox';
import { rewardsApi } from '../api/rewards';
import useAuthStore from '../store/authStore';
import { useI18n } from '../i18n';
import { useTheme } from '../theme';

const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const formatNumber = (value) => numberFormatter.format(Number(value || 0));

const STATUS_VALUES = ['', 'pending', 'processing', 'shipped', 'completed', 'rejected', 'cancelled'];
const SORT_VALUES = ['created_at', 'points_asc', 'points_desc', 'popular', 'name'];

const isHttpUrl = (value) => typeof value === 'string' && /^https?:\/\//.test(value);

const tFallback = (t, key, fallback, params) => {
  const value = t(key, params);
  return value === key ? fallback : value;
};

const resolveImageUri = (...candidates) => {
  const queue = candidates.flat().filter(Boolean);
  for (const candidate of queue) {
    if (typeof candidate === 'string' && isHttpUrl(candidate)) {
      return candidate;
    }
    if (candidate && typeof candidate === 'object') {
      const direct = candidate.public_url || candidate.url || candidate.presigned_url || candidate.image_url || candidate.image_presigned_url;
      if (isHttpUrl(direct)) {
        return direct;
      }
    }
  }
  return null;
};

const resolveProductImage = (product) => resolveImageUri(
  Array.isArray(product?.images) ? product.images : [product?.images],
  product?.image_url,
  product?.image_presigned_url,
);

const resolveExchangeImage = (exchange) => resolveImageUri(
  Array.isArray(exchange?.current_product_images) ? exchange.current_product_images : [exchange?.current_product_images],
);

const resolveProductName = (exchange, t) => (
  exchange.current_product_name
  || exchange.product_name
  || exchange.product?.name
  || t('store.history.unknownProduct')
);

const getApiErrorMessage = (error, fallback) => (
  error?.response?.data?.message
  || error?.response?.data?.error
  || error?.message
  || fallback
);

function PointsCard({ points }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  return (
    <GlassSurface
      contentStyle={styles.pointsCardContent}
      effect="clear"
      style={styles.pointsCard}
      tintColor={colors.primarySoft}
    >
      <Ionicons color={colors.primary} name="wallet-outline" size={24} />
      <View style={styles.pointsText}>
        <Text style={[styles.pointsLabel, { color: colors.textMuted }]}>{t('store.yourPoints')}</Text>
        <Text style={[styles.pointsValue, { color: colors.text }]}>
          {formatNumber(points)} {t('units.points')}
        </Text>
      </View>
    </GlassSurface>
  );
}

function ProductCard({ product, onExchange, userPoints }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const imageUri = resolveProductImage(product);
  const pointsRequired = Number(product.points_required || 0);
  const stock = Number(product.stock ?? 0);
  const isAvailable = product.is_available !== false && (product.status ? product.status === 'active' : true);
  const isInStock = stock === -1 || stock > 0;
  const canAfford = userPoints >= pointsRequired;
  const disabledReason = !isAvailable
    ? t('store.unavailable')
    : !isInStock
      ? t('store.outOfStock')
      : !canAfford
        ? t('store.insufficientPoints')
        : '';
  const category = product.category_slug || product.category || '';
  const categoryLabel = category
    ? tFallback(t, `store.categories.${category}`, category)
    : t('store.uncategorized');
  const remaining = userPoints - pointsRequired;

  return (
    <GlassSurface effect="regular" padded={false} style={styles.productCard}>
      {imageUri ? (
        <ImageLightbox uri={imageUri} title={product.name} style={styles.productImageButton} contentStyle={styles.imageFill}>
          <Image source={{ uri: imageUri }} style={styles.productImage} />
        </ImageLightbox>
      ) : (
        <View style={[styles.productImage, styles.productImageEmpty, { backgroundColor: colors.surfaceMuted }]}>
          <Ionicons color={colors.primary} name="bag-handle-outline" size={34} />
        </View>
      )}
      <View style={styles.productBody}>
        <View style={styles.productHeader}>
          <View style={styles.productTitleBox}>
            <Text numberOfLines={2} style={[styles.productTitle, { color: colors.text }]}>{product.name}</Text>
            <Text numberOfLines={1} style={[styles.productMeta, { color: colors.textMuted }]}>{categoryLabel}</Text>
          </View>
          {product.is_featured ? (
            <View style={[styles.featuredBadge, { backgroundColor: colors.primarySoft }]}>
              <Ionicons color={colors.primary} name="star" size={12} />
              <Text style={[styles.featuredText, { color: colors.primary }]}>{t('store.featured')}</Text>
            </View>
          ) : null}
        </View>
        <Text numberOfLines={3} style={[styles.productDescription, { color: colors.textMuted }]}>
          {product.description || t('store.noDescription')}
        </Text>
        <View style={styles.productStats}>
          <View>
            <Text style={[styles.statTiny, { color: colors.textMuted }]}>{t('store.pointsRequired')}</Text>
            <Text style={[styles.productPoints, { color: colors.primary }]}>
              {formatNumber(pointsRequired)} {t('units.points')}
            </Text>
          </View>
          <View style={styles.stockBox}>
            <Ionicons color={stock === 0 ? colors.danger : colors.textMuted} name="cube-outline" size={15} />
            <Text style={[styles.stockText, { color: stock === 0 ? colors.danger : colors.textMuted }]}>
              {stock === -1 ? t('store.unlimited') : t('store.stock', { count: stock })}
            </Text>
          </View>
        </View>
        <PrimaryButton
          title={disabledReason || t('store.exchange.button')}
          disabled={Boolean(disabledReason)}
          onPress={() => onExchange(product)}
          icon="cart-outline"
        />
        {!disabledReason ? (
          <Text style={[styles.afterExchange, { color: colors.textMuted }]}>
            {t('store.afterExchange')}: {formatNumber(remaining)} {t('units.points')}
          </Text>
        ) : null}
      </View>
    </GlassSurface>
  );
}

function FilterOption({ active, label, onPress }) {
  const { colors } = useTheme();
  return (
    <GlassPressable
      onPress={onPress}
      style={[styles.menuOption, active ? { borderColor: colors.primary } : null]}
      contentStyle={styles.menuOptionContent}
      tintColor={active ? colors.primarySoft : colors.surfaceMuted}
    >
      <Text numberOfLines={1} style={[styles.menuOptionText, { color: active ? colors.primary : colors.text }]}>
        {label}
      </Text>
      {active ? <Ionicons color={colors.primary} name="checkmark-circle" size={18} /> : null}
    </GlassPressable>
  );
}

function ProductFilterMenu({
  activeCategoryLabel,
  categories,
  filters,
  onCategoryChange,
  onSortChange,
  sortLabel,
}) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const categoryOptions = useMemo(() => [
    { value: '', label: t('store.filters.allCategories') },
    ...categories.map((category, index) => {
      const value = String(category.slug || category.category || category.name || index);
      const count = category.product_count ?? category.count ?? 0;
      return {
        value,
        label: `${category.name || value}${count ? ` (${count})` : ''}`,
      };
    }),
  ], [categories, t]);
  const sortOptions = SORT_VALUES.map((value) => ({
    value,
    label: t(`store.filters.sort.${value}`),
  }));

  return (
    <>
      <GlassPressable
        onPress={() => setVisible(true)}
        style={styles.filterMenuButton}
        contentStyle={styles.filterMenuButtonContent}
      >
        <View style={styles.filterMenuIcon}>
          <Ionicons color={colors.primary} name="options-outline" size={20} />
        </View>
        <View style={styles.filterMenuTextBox}>
          <Text style={[styles.filterMenuTitle, { color: colors.text }]}>{t('store.filters.menuTitle')}</Text>
          <Text numberOfLines={1} style={[styles.filterMenuSubtitle, { color: colors.textMuted }]}>
            {t('store.filters.menuSubtitle', { category: activeCategoryLabel, sort: sortLabel })}
          </Text>
        </View>
        <Ionicons color={colors.textMuted} name="chevron-down" size={18} />
      </GlassPressable>

      <Modal animationType="fade" onRequestClose={() => setVisible(false)} transparent visible={visible}>
        <View style={styles.menuBackdrop}>
          <GlassSurface effect="regular" style={styles.menuSheet} contentStyle={styles.menuContent}>
            <View style={styles.menuHeader}>
              <View style={styles.menuHeaderText}>
                <Text style={[styles.menuTitle, { color: colors.text }]}>{t('store.filters.menuTitle')}</Text>
                <Text style={[styles.menuSubtitle, { color: colors.textMuted }]}>
                  {t('store.filters.menuSubtitle', { category: activeCategoryLabel, sort: sortLabel })}
                </Text>
              </View>
              <GlassButtonSurface onPress={() => setVisible(false)} style={styles.closeButton}>
                <Ionicons color={colors.text} name="close" size={22} />
              </GlassButtonSurface>
            </View>

            <ScrollView contentContainerStyle={styles.menuScroll} showsVerticalScrollIndicator={false}>
              <Text style={[styles.menuSectionTitle, { color: colors.textMuted }]}>{t('store.filters.categorySection')}</Text>
              <View style={styles.menuOptions}>
                {categoryOptions.map((option) => (
                  <FilterOption
                    key={option.value || 'all'}
                    active={filters.category === option.value}
                    label={option.label}
                    onPress={() => onCategoryChange(option.value)}
                  />
                ))}
              </View>

              <Text style={[styles.menuSectionTitle, { color: colors.textMuted }]}>{t('store.filters.sortSection')}</Text>
              <View style={styles.menuOptions}>
                {sortOptions.map((option) => (
                  <FilterOption
                    key={option.value}
                    active={filters.sort === option.value}
                    label={option.label}
                    onPress={() => onSortChange(option.value)}
                  />
                ))}
              </View>
            </ScrollView>

            <GlassButtonSurface onPress={() => setVisible(false)} variant="primary">
              <Text style={[styles.menuDoneText, { color: colors.primary }]}>{t('store.filters.close')}</Text>
            </GlassButtonSurface>
          </GlassSurface>
        </View>
      </Modal>
    </>
  );
}

function OptionMenu({ icon = 'filter-outline', label, onChange, options, title, value }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const selected = options.find((option) => option.value === value) || options[0];

  return (
    <>
      <GlassPressable
        onPress={() => setVisible(true)}
        style={styles.filterMenuButton}
        contentStyle={styles.filterMenuButtonContent}
      >
        <View style={styles.filterMenuIcon}>
          <Ionicons color={colors.primary} name={icon} size={20} />
        </View>
        <View style={styles.filterMenuTextBox}>
          <Text style={[styles.filterMenuTitle, { color: colors.text }]}>{title}</Text>
          <Text numberOfLines={1} style={[styles.filterMenuSubtitle, { color: colors.textMuted }]}>
            {label || selected?.label}
          </Text>
        </View>
        <Ionicons color={colors.textMuted} name="chevron-down" size={18} />
      </GlassPressable>

      <Modal animationType="fade" onRequestClose={() => setVisible(false)} transparent visible={visible}>
        <View style={styles.menuBackdrop}>
          <GlassSurface effect="regular" style={styles.menuSheet} contentStyle={styles.menuContent}>
            <View style={styles.menuHeader}>
              <View style={styles.menuHeaderText}>
                <Text style={[styles.menuTitle, { color: colors.text }]}>{title}</Text>
                <Text style={[styles.menuSubtitle, { color: colors.textMuted }]}>{label || selected?.label}</Text>
              </View>
              <GlassButtonSurface onPress={() => setVisible(false)} style={styles.closeButton}>
                <Ionicons color={colors.text} name="close" size={22} />
              </GlassButtonSurface>
            </View>
            <View style={styles.menuOptions}>
              {options.map((option) => (
                <FilterOption
                  key={option.value || 'all'}
                  active={value === option.value}
                  label={option.label}
                  onPress={() => onChange(option.value)}
                />
              ))}
            </View>
            <GlassButtonSurface onPress={() => setVisible(false)} variant="primary">
              <Text style={[styles.menuDoneText, { color: colors.primary }]}>{t('store.filters.close')}</Text>
            </GlassButtonSurface>
          </GlassSurface>
        </View>
      </Modal>
    </>
  );
}

function ExchangeModal({ product, visible, onClose, onConfirm, loading, userEmail, userPoints }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [quantity, setQuantity] = useState('1');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [contactAreaCode, setContactAreaCode] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (visible) {
      setQuantity('1');
      setDeliveryAddress(userEmail || '');
      setContactAreaCode('');
      setContactPhone('');
      setNotes('');
    }
  }, [product?.id, userEmail, visible]);

  if (!product) {
    return null;
  }

  const pointsRequired = Number(product.points_required || 0);
  const stock = Number(product.stock ?? 0);
  const maxByPoints = pointsRequired > 0 ? Math.floor(userPoints / pointsRequired) : 1;
  const maxQuantity = Math.max(1, stock === -1 ? Math.min(10, maxByPoints || 1) : Math.min(stock, maxByPoints || 1));
  const parsedQuantity = Math.max(1, Math.min(maxQuantity, Number.parseInt(quantity, 10) || 1));
  const totalPoints = pointsRequired * parsedQuantity;
  const canAfford = userPoints >= totalPoints;
  const imageUri = resolveProductImage(product);

  const submit = () => {
    const trimmedAddress = deliveryAddress.trim();
    const trimmedAreaCode = contactAreaCode.trim();
    const trimmedPhone = contactPhone.trim();
    if (!trimmedAddress) {
      Alert.alert(t('store.exchange.failed'), t('store.exchange.addressRequired'));
      return;
    }
    if (trimmedPhone && !/^[0-9\-\s]{5,20}$/.test(trimmedPhone)) {
      Alert.alert(t('store.exchange.failed'), t('store.exchange.invalidPhone'));
      return;
    }
    if (trimmedAreaCode && !/^\+?\d{1,5}$/.test(trimmedAreaCode)) {
      Alert.alert(t('store.exchange.failed'), t('store.exchange.invalidAreaCode'));
      return;
    }
    onConfirm({
      product_id: product.id,
      quantity: parsedQuantity,
      delivery_address: trimmedAddress,
      contact_area_code: trimmedAreaCode || undefined,
      contact_phone: trimmedPhone || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalKeyboard}
      >
        <View style={styles.modalBackdrop}>
          <GlassSurface padded={false} style={styles.modalSheet}>
            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleBox}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>{t('store.exchange.title')}</Text>
                <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>{t('store.exchange.subtitle')}</Text>
              </View>
              <GlassButtonSurface onPress={onClose} style={styles.closeButton}>
                <Ionicons color={colors.text} name="close" size={22} />
              </GlassButtonSurface>
            </View>

              <GlassListItemSurface contentStyle={styles.exchangeProductContent} style={styles.exchangeProduct}>
                {imageUri ? (
                  <ImageLightbox uri={imageUri} title={product.name} style={styles.exchangeImageButton} contentStyle={styles.imageFill}>
                    <Image source={{ uri: imageUri }} style={styles.exchangeImage} />
                  </ImageLightbox>
                ) : null}
              <View style={styles.exchangeProductText}>
                <Text style={[styles.productTitle, { color: colors.text }]}>{product.name}</Text>
                <Text style={[styles.productMeta, { color: colors.textMuted }]}>
                  {formatNumber(pointsRequired)} {t('units.points')} / {stock === -1 ? t('store.unlimited') : t('store.stock', { count: stock })}
                </Text>
              </View>
              </GlassListItemSurface>

            <View style={styles.quantityRow}>
              <SecondaryButton
                title="-"
                disabled={parsedQuantity <= 1}
                onPress={() => setQuantity(String(Math.max(1, parsedQuantity - 1)))}
              />
              <View style={styles.quantityInput}>
                <Field
                  label={t('store.exchange.quantity')}
                  value={String(parsedQuantity)}
                  onChangeText={(value) => setQuantity(value.replace(/[^\d]/g, ''))}
                  keyboardType="number-pad"
                />
              </View>
              <SecondaryButton
                title="+"
                disabled={parsedQuantity >= maxQuantity}
                onPress={() => setQuantity(String(Math.min(maxQuantity, parsedQuantity + 1)))}
              />
            </View>
            <Text style={[styles.formHint, { color: colors.textMuted }]}>{t('store.exchange.maxQuantity', { max: maxQuantity })}</Text>

            <Field
              label={t('store.exchange.deliveryAddress')}
              placeholder={t('store.exchange.addressPlaceholder')}
              value={deliveryAddress}
              onChangeText={setDeliveryAddress}
            />
            <View style={styles.phoneRow}>
              <View style={styles.areaCode}>
                <Field
                  label={t('store.exchange.areaCode')}
                  placeholder="+86"
                  value={contactAreaCode}
                  onChangeText={setContactAreaCode}
                  keyboardType="phone-pad"
                />
              </View>
              <View style={styles.phone}>
                <Field
                  label={t('store.exchange.contactPhone')}
                  placeholder={t('store.exchange.phonePlaceholder')}
                  value={contactPhone}
                  onChangeText={setContactPhone}
                  keyboardType="phone-pad"
                />
              </View>
            </View>
            <Field
              label={t('store.exchange.notes')}
              placeholder={t('store.exchange.notesPlaceholder')}
              value={notes}
              onChangeText={setNotes}
              multiline
              style={styles.notesInput}
              textAlignVertical="top"
            />

            <GlassListItemSurface contentStyle={styles.totalBox} tintColor={colors.primarySoft}>
              <Text style={[styles.totalRow, { color: colors.text }]}>
                {t('store.exchange.totalCost')}: {formatNumber(totalPoints)} {t('units.points')}
              </Text>
              <Text style={[styles.totalHint, { color: canAfford ? colors.primary : colors.danger }]}>
                {t('store.exchange.afterExchange')}: {formatNumber(userPoints - totalPoints)} {t('units.points')}
              </Text>
            </GlassListItemSurface>

            <View style={styles.modalActions}>
              <SecondaryButton title={t('profile.cancel')} disabled={loading} onPress={onClose} />
              <PrimaryButton
                title={t('store.exchange.confirm')}
                loading={loading}
                disabled={!canAfford}
                onPress={submit}
                icon="checkmark-circle-outline"
              />
            </View>
            </ScrollView>
          </GlassSurface>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ExchangeCard({ exchange }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const imageUri = resolveExchangeImage(exchange);
  const status = String(exchange.status || 'unknown').toLowerCase();
  const contact = [exchange.contact_area_code, exchange.contact_phone].filter(Boolean).join(' ');
  const quantity = Number(exchange.quantity || 1);
  const points = Number(exchange.points_used ?? exchange.total_points ?? 0);

  return (
    <GlassListItemSurface contentStyle={styles.exchangeCardContent} style={styles.exchangeCard}>
      {imageUri ? (
        <ImageLightbox uri={imageUri} title={resolveProductName(exchange, t)} style={styles.historyImageButton} contentStyle={styles.imageFill}>
          <Image source={{ uri: imageUri }} style={styles.historyImage} />
        </ImageLightbox>
      ) : (
        <View style={[styles.historyImage, styles.productImageEmpty, { backgroundColor: colors.surfaceMuted }]}>
          <Ionicons color={colors.primary} name="cube-outline" size={24} />
        </View>
      )}
      <View style={styles.historyMain}>
        <View style={styles.historyTop}>
          <Text numberOfLines={2} style={[styles.historyTitle, { color: colors.text }]}>{resolveProductName(exchange, t)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: colors.primarySoft }]}>
            <Text style={[styles.statusText, { color: colors.primary }]}>
              {tFallback(t, `store.history.statuses.${status}`, status)}
            </Text>
          </View>
        </View>
        <Text style={[styles.historyMeta, { color: colors.textMuted }]}>
          {t('store.history.orderDate')}: {String(exchange.created_at || '').split(/[T ]/).slice(0, 2).join(' ') || t('app.emptyValue')}
        </Text>
        <Text style={[styles.historyMeta, { color: colors.textMuted }]}>
          {t('store.history.quantity')}: {quantity} / {t('store.history.pointsUsed')}: {formatNumber(points)} {t('units.points')}
        </Text>
        <Text numberOfLines={2} style={[styles.historyMeta, { color: colors.textMuted }]}>
          {t('store.history.deliveryInfo')}: {exchange.delivery_address || t('store.history.notProvided')}
        </Text>
        {contact ? (
          <Text style={[styles.historyMeta, { color: colors.textMuted }]}>
            {t('store.history.contactPhone')}: {contact}
          </Text>
        ) : null}
        {exchange.tracking_number ? (
          <Text style={[styles.historyMeta, { color: colors.textMuted }]}>
            {t('store.history.trackingNumber')}: {exchange.tracking_number}
          </Text>
        ) : null}
      </View>
    </GlassListItemSurface>
  );
}

export default function StoreScreen() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const isWide = width >= 720;

  const [view, setView] = useState('products');
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    sort: 'created_at',
    page: 1,
  });
  const [historyFilters, setHistoryFilters] = useState({ status: '', page: 1 });
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showExchangeModal, setShowExchangeModal] = useState(false);

  const userPoints = Number(user?.points || 0);

  const categoriesQuery = useQuery({
    queryKey: ['mobile-store-categories'],
    queryFn: () => rewardsApi.getCategories({ limit: 50 }),
  });
  const productsQuery = useQuery({
    queryKey: ['mobile-store-products', filters],
    queryFn: () => rewardsApi.getProducts({
      page: filters.page,
      limit: 12,
      sort: filters.sort,
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.search.trim() ? { search: filters.search.trim() } : {}),
    }),
  });
  const historyQuery = useQuery({
    queryKey: ['mobile-store-exchanges', historyFilters],
    queryFn: () => rewardsApi.getExchangeTransactions({
      page: historyFilters.page,
      limit: 10,
      sort: 'created_at_desc',
      ...(historyFilters.status ? { status: historyFilters.status } : {}),
    }),
    enabled: view === 'history',
  });

  const exchangeMutation = useMutation({
    mutationFn: rewardsApi.exchangeProduct,
    onSuccess: async (result) => {
      const remaining = result?.remaining_points;
      if (typeof remaining === 'number' && user) {
        await setUser({ ...user, points: remaining });
      }
      setShowExchangeModal(false);
      setSelectedProduct(null);
      queryClient.invalidateQueries({ queryKey: ['mobile-store-products'] });
      queryClient.invalidateQueries({ queryKey: ['mobile-store-exchanges'] });
      queryClient.invalidateQueries({ queryKey: ['mobile-dashboard-stats'] });
      Alert.alert(t('store.exchange.successTitle'), t('store.exchange.successMessage', {
        points: formatNumber(result?.points_used || 0),
      }));
    },
    onError: (error) => {
      Alert.alert(t('store.exchange.failed'), getApiErrorMessage(error, t('store.errors.exchangeFailed')));
    },
  });

  const products = productsQuery.data?.products || [];
  const productPagination = productsQuery.data?.pagination || { page: 1, pages: 1, total: 0 };
  const categories = Array.isArray(categoriesQuery.data) ? categoriesQuery.data : [];
  const exchanges = historyQuery.data?.exchanges || [];
  const historyPagination = historyQuery.data?.pagination || { page: 1, pages: 1, total: 0 };
  const refreshing = productsQuery.isFetching || categoriesQuery.isFetching || historyQuery.isFetching;

  const activeCategoryLabel = useMemo(() => {
    if (!filters.category) {
      return t('store.filters.allCategories');
    }
    const category = categories.find((item) => String(item.slug || item.category || item.name) === String(filters.category));
    return category?.name || filters.category;
  }, [categories, filters.category, t]);
  const activeSortLabel = t(`store.filters.sort.${filters.sort}`);
  const activeStatusLabel = historyFilters.status
    ? tFallback(t, `store.history.statuses.${historyFilters.status}`, historyFilters.status)
    : t('store.history.filters.statusAll');

  const refresh = () => {
    categoriesQuery.refetch();
    productsQuery.refetch();
    if (view === 'history') {
      historyQuery.refetch();
    }
  };

  const openExchange = (product) => {
    setSelectedProduct(product);
    setShowExchangeModal(true);
  };

  const setProductPage = (page) => {
    setFilters((prev) => ({ ...prev, page }));
  };

  const setHistoryPage = (page) => {
    setHistoryFilters((prev) => ({ ...prev, page }));
  };

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={[styles.container, isWide ? styles.containerWide : null]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <PageHeader eyebrow={t('store.eyebrow')} title={t('store.title')} subtitle={t('store.subtitle')} />
        <View style={[styles.topGrid, isWide ? styles.topGridWide : null]}>
          <PointsCard points={userPoints} />
          <GlassSurface style={styles.topControl} contentStyle={styles.controlContent}>
            <SegmentedControl
              value={view}
              onChange={setView}
              options={[
                { value: 'products', label: t('store.views.products') },
                { value: 'history', label: t('store.views.history') },
              ]}
            />
          </GlassSurface>
        </View>

        {view === 'products' ? (
          <>
            <GlassSurface contentStyle={styles.filters}>
              <Field
                label={t('store.filters.search')}
                placeholder={t('store.filters.searchPlaceholder')}
                value={filters.search}
                onChangeText={(value) => setFilters((prev) => ({ ...prev, search: value, page: 1 }))}
                returnKeyType="search"
              />
              <ProductFilterMenu
                activeCategoryLabel={activeCategoryLabel}
                categories={categories}
                filters={filters}
                onCategoryChange={(value) => setFilters((prev) => ({ ...prev, category: value, page: 1 }))}
                onSortChange={(value) => setFilters((prev) => ({ ...prev, sort: value, page: 1 }))}
                sortLabel={activeSortLabel}
              />
              <GlassListItemSurface contentStyle={styles.activeFilter} tintColor={colors.primarySoft}>
                <Ionicons color={colors.primary} name="filter-outline" size={15} />
                <Text style={[styles.activeFilterText, { color: colors.primary }]}>
                  {t('store.filters.current')}: {activeCategoryLabel} / {activeSortLabel}
                </Text>
              </GlassListItemSurface>
            </GlassSurface>

            {productsQuery.isLoading ? (
              <ActivityIndicator color={colors.primary} size="large" />
            ) : products.length ? (
              <View style={[styles.productGrid, isWide ? styles.productGridWide : null]}>
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    userPoints={userPoints}
                    onExchange={openExchange}
                  />
                ))}
              </View>
            ) : (
              <GlassSurface contentStyle={styles.emptyState}>
                <Ionicons color={colors.primary} name="bag-outline" size={34} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('store.noProducts.title')}</Text>
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('store.noProducts.description')}</Text>
              </GlassSurface>
            )}

            {productPagination.pages > 1 ? (
              <View style={styles.pagination}>
                <SecondaryButton
                  title={t('store.previous')}
                  disabled={Number(productPagination.page) <= 1}
                  onPress={() => setProductPage(Number(productPagination.page) - 1)}
                />
                <Text style={[styles.pageText, { color: colors.textMuted }]}>
                  {productPagination.page} / {productPagination.pages}
                </Text>
                <SecondaryButton
                  title={t('store.next')}
                  disabled={Number(productPagination.page) >= Number(productPagination.pages)}
                  onPress={() => setProductPage(Number(productPagination.page) + 1)}
                />
              </View>
            ) : null}
          </>
        ) : (
          <>
            <GlassSurface contentStyle={styles.filters}>
              <OptionMenu
                title={t('store.history.filters.status')}
                label={activeStatusLabel}
                value={historyFilters.status}
                onChange={(value) => setHistoryFilters({ status: value, page: 1 })}
                options={STATUS_VALUES.map((value) => ({
                  value,
                  label: value ? tFallback(t, `store.history.statuses.${value}`, value) : t('store.history.filters.statusAll'),
                }))}
              />
            </GlassSurface>

            {historyQuery.isLoading ? (
              <ActivityIndicator color={colors.primary} size="large" />
            ) : exchanges.length ? (
              <View style={styles.historyList}>
                {exchanges.map((exchange) => <ExchangeCard key={exchange.id} exchange={exchange} />)}
              </View>
            ) : (
              <GlassSurface contentStyle={styles.emptyState}>
                <Ionicons color={colors.primary} name="receipt-outline" size={34} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('store.history.emptyTitle')}</Text>
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('store.history.emptyDescription')}</Text>
              </GlassSurface>
            )}

            {historyPagination.pages > 1 ? (
              <View style={styles.pagination}>
                <SecondaryButton
                  title={t('store.previous')}
                  disabled={Number(historyPagination.page) <= 1}
                  onPress={() => setHistoryPage(Number(historyPagination.page) - 1)}
                />
                <Text style={[styles.pageText, { color: colors.textMuted }]}>
                  {historyPagination.page} / {historyPagination.pages}
                </Text>
                <SecondaryButton
                  title={t('store.next')}
                  disabled={Number(historyPagination.page) >= Number(historyPagination.pages)}
                  onPress={() => setHistoryPage(Number(historyPagination.page) + 1)}
                />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      <ExchangeModal
        product={selectedProduct}
        visible={showExchangeModal}
        onClose={() => {
          setShowExchangeModal(false);
          setSelectedProduct(null);
        }}
        onConfirm={(payload) => exchangeMutation.mutate(payload)}
        loading={exchangeMutation.isPending}
        userEmail={user?.email || ''}
        userPoints={userPoints}
      />
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
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
  topGrid: {
    gap: 12,
  },
  topGridWide: {
    alignItems: 'stretch',
    flexDirection: 'row',
  },
  pointsCard: {
    borderRadius: 22,
    flex: 1,
    minHeight: 96,
  },
  pointsCardContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  pointsText: {
    gap: 4,
  },
  pointsLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  pointsValue: {
    fontSize: 24,
    fontWeight: '900',
  },
  topControl: {
    flex: 1,
    justifyContent: 'center',
  },
  controlContent: {
    justifyContent: 'center',
  },
  filters: {
    gap: 14,
  },
  activeFilter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    padding: 12,
  },
  activeFilterText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
  },
  productGrid: {
    gap: 14,
  },
  productGridWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  productCard: {
    borderRadius: 22,
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 280,
  },
  productImage: {
    aspectRatio: 1.65,
    width: '100%',
  },
  productImageButton: {
    borderRadius: 0,
  },
  productImageEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  productBody: {
    gap: 12,
    padding: 16,
  },
  productHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  productTitleBox: {
    flex: 1,
    minWidth: 0,
  },
  productTitle: {
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 22,
  },
  productMeta: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  featuredBadge: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  featuredText: {
    fontSize: 11,
    fontWeight: '900',
  },
  productDescription: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  productStats: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statTiny: {
    fontSize: 11,
    fontWeight: '800',
  },
  productPoints: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 3,
  },
  stockBox: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  stockText: {
    fontSize: 12,
    fontWeight: '800',
  },
  afterExchange: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  historyList: {
    gap: 12,
  },
  exchangeCard: {
    borderRadius: 22,
  },
  exchangeCardContent: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  historyImage: {
    borderRadius: 16,
    height: 84,
    width: 84,
  },
  historyImageButton: {
    borderRadius: 16,
    height: 84,
    width: 84,
  },
  imageFill: {
    width: '100%',
  },
  historyMain: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  historyTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  historyTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 20,
  },
  historyMeta: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '900',
  },
  emptyState: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 18,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'center',
  },
  pagination: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  pageText: {
    fontSize: 13,
    fontWeight: '900',
    minWidth: 64,
    textAlign: 'center',
  },
  filterMenuButton: {
    borderRadius: 20,
  },
  filterMenuButtonContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 62,
    padding: 12,
  },
  filterMenuIcon: {
    alignItems: 'center',
    borderRadius: 16,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  filterMenuTextBox: {
    flex: 1,
    minWidth: 0,
  },
  filterMenuTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  filterMenuSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  menuBackdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.38)',
    flex: 1,
    justifyContent: 'flex-end',
    padding: 14,
  },
  menuSheet: {
    borderRadius: 28,
    maxHeight: '78%',
  },
  menuContent: {
    gap: 14,
    padding: 16,
  },
  menuHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  menuHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  menuTitle: {
    fontSize: 19,
    fontWeight: '900',
  },
  menuSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 3,
  },
  menuScroll: {
    gap: 12,
    paddingBottom: 2,
  },
  menuSectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  menuOptions: {
    gap: 8,
  },
  menuOption: {
    borderRadius: 18,
  },
  menuOptionContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 12,
  },
  menuOptionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
  },
  menuDoneText: {
    fontSize: 15,
    fontWeight: '900',
  },
  modalKeyboard: {
    flex: 1,
  },
  modalBackdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
  },
  modalContent: {
    gap: 14,
    padding: 20,
    paddingBottom: 34,
  },
  modalHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
  },
  modalTitleBox: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
  },
  modalSubtitle: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 4,
  },
  closeButton: {
    borderRadius: 19,
    height: 38,
    minHeight: 38,
    paddingHorizontal: 0,
    width: 38,
  },
  exchangeProduct: {
    borderRadius: 18,
  },
  exchangeProductContent: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  exchangeImage: {
    borderRadius: 14,
    height: 70,
    width: 70,
  },
  exchangeImageButton: {
    borderRadius: 14,
    height: 70,
    width: 70,
  },
  exchangeProductText: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  quantityRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 10,
  },
  quantityInput: {
    flex: 1,
  },
  formHint: {
    fontSize: 12,
    fontWeight: '700',
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 10,
  },
  areaCode: {
    width: 102,
  },
  phone: {
    flex: 1,
  },
  notesInput: {
    minHeight: 88,
    paddingTop: 12,
  },
  totalBox: {
    borderRadius: 18,
    gap: 6,
    padding: 14,
  },
  totalRow: {
    fontSize: 16,
    fontWeight: '900',
  },
  totalHint: {
    fontSize: 13,
    fontWeight: '800',
  },
  modalActions: {
    gap: 10,
  },
});
