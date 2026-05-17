import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassButtonSurface, GlassFieldSurface } from './Glass';
import { useTheme } from '../theme';

export function Field({ label, error, ...inputProps }) {
  const { colors } = useTheme();
  const { style: inputStyle, ...textInputProps } = inputProps;
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <GlassFieldSurface error={error}>
        <TextInput
          {...textInputProps}
          placeholderTextColor={colors.textMuted}
          style={[
            styles.input,
            { color: colors.text },
            inputStyle,
          ]}
        />
      </GlassFieldSurface>
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

export function PrimaryButton({ title, loading, disabled, onPress, icon }) {
  const { colors } = useTheme();
  return (
    <GlassButtonSurface
      onPress={onPress}
      disabled={disabled || loading}
      variant="primary"
    >
      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <View style={styles.buttonContent}>
          {icon ? <Ionicons color={colors.primary} name={icon} size={18} /> : null}
          <Text style={[styles.buttonText, { color: colors.primary }]}>{title}</Text>
        </View>
      )}
    </GlassButtonSurface>
  );
}

export function LinkButton({ title, onPress }) {
  const { colors } = useTheme();
  return (
    <GlassButtonSurface
      contentStyle={styles.linkButton}
      effect="clear"
      onPress={onPress}
      style={styles.linkSurface}
      variant="secondary"
    >
      <Text style={[styles.linkText, { color: colors.primary }]}>{title}</Text>
    </GlassButtonSurface>
  );
}

export function SecondaryButton({ title, loading, disabled, onPress, icon }) {
  const { colors } = useTheme();
  return (
    <GlassButtonSurface
      onPress={onPress}
      disabled={disabled || loading}
      variant="secondary"
    >
      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <View style={styles.buttonContent}>
          {icon ? <Ionicons color={colors.primary} name={icon} size={18} /> : null}
          <Text style={[styles.secondaryText, { color: colors.text }]}>{title}</Text>
        </View>
      )}
    </GlassButtonSurface>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    fontSize: 15,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  error: {
    fontSize: 12,
  },
  buttonContent: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '800',
    includeFontPadding: false,
    lineHeight: 20,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: '800',
    includeFontPadding: false,
    lineHeight: 19,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  linkButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkSurface: {
    borderRadius: 16,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  linkText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
