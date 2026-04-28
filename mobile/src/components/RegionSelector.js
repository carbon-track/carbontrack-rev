import React, { useMemo } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import countries from '../data/states.json';

const getCountryLabel = (country) => country.translations?.cn || country.name;

export default function RegionSelector({ countryCode, stateCode, onCountryChange, onStateChange }) {
  const states = useMemo(() => {
    const selected = countries.find((country) => country.iso2 === countryCode);
    return selected?.states || [];
  }, [countryCode]);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>国家 / 地区</Text>
      <View style={styles.pickerBox}>
        <Picker
          selectedValue={countryCode}
          onValueChange={(value) => {
            onCountryChange(value);
            onStateChange('');
          }}
        >
          <Picker.Item label="请选择国家 / 地区" value="" />
          {countries.map((country) => (
            <Picker.Item key={country.iso2} label={getCountryLabel(country)} value={country.iso2} />
          ))}
        </Picker>
      </View>

      <Text style={styles.label}>省 / 州</Text>
      <View style={styles.pickerBox}>
        {states.length > 0 ? (
          <Picker selectedValue={stateCode} enabled={Boolean(countryCode)} onValueChange={onStateChange}>
            <Picker.Item label="请选择省 / 州" value="" />
            {states.map((state) => (
              <Picker.Item key={state.id || state.state_code} label={state.name} value={state.state_code} />
            ))}
          </Picker>
        ) : (
          <Picker selectedValue={stateCode} enabled={false} onValueChange={onStateChange}>
            <Picker.Item label={countryCode ? '暂无地区数据' : '请先选择国家 / 地区'} value="" />
          </Picker>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
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
});
