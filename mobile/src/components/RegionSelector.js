import React, { useMemo } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import countries from '../data/states.json';
import { GlassPickerSurface } from './Glass';
import { useI18n } from '../i18n';
import { useTheme } from '../theme';

const getCountryLabel = (country, language) => (
  language === 'zh' ? country.translations?.cn || country.name : country.name
);

export default function RegionSelector({ countryCode, stateCode, onCountryChange, onStateChange }) {
  const { resolvedLanguage, t } = useI18n();
  const { colors } = useTheme();
  const states = useMemo(() => {
    const selected = countries.find((country) => country.iso2 === countryCode);
    return selected?.states || [];
  }, [countryCode]);

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, { color: colors.text }]}>{t('region.country')}</Text>
      <GlassPickerSurface>
        <Picker
          dropdownIconColor={colors.text}
          style={{ color: colors.text }}
          selectedValue={countryCode}
          onValueChange={(value) => {
            onCountryChange(value);
            onStateChange('');
          }}
        >
          <Picker.Item label={t('region.countryPlaceholder')} value="" />
          {countries.map((country) => (
            <Picker.Item key={country.iso2} label={getCountryLabel(country, resolvedLanguage)} value={country.iso2} />
          ))}
        </Picker>
      </GlassPickerSurface>

      <Text style={[styles.label, { color: colors.text }]}>{t('region.state')}</Text>
      <GlassPickerSurface>
        {states.length > 0 ? (
          <Picker
            dropdownIconColor={colors.text}
            selectedValue={stateCode}
            enabled={Boolean(countryCode)}
            onValueChange={onStateChange}
            style={{ color: colors.text }}
          >
            <Picker.Item label={t('region.statePlaceholder')} value="" />
            {states.map((state) => (
              <Picker.Item key={state.id || state.state_code} label={state.name} value={state.state_code} />
            ))}
          </Picker>
        ) : (
          <Picker
            dropdownIconColor={colors.textMuted}
            selectedValue={stateCode}
            enabled={false}
            onValueChange={onStateChange}
            style={{ color: colors.textMuted }}
          >
            <Picker.Item label={countryCode ? t('region.stateMissing') : t('region.countryFirst')} value="" />
          </Picker>
        )}
      </GlassPickerSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
  },
});
