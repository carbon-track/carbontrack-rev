import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';

export function Field({ label, error, ...inputProps }) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <TextInput
        {...inputProps}
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          { backgroundColor: colors.input, borderColor: colors.borderStrong, color: colors.text },
          error ? { borderColor: colors.danger } : null,
          inputProps.style,
        ]}
      />
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

export function PrimaryButton({ title, loading, disabled, onPress, icon }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.primary },
        pressed ? { backgroundColor: colors.primaryPressed } : null,
        disabled || loading ? { opacity: 0.55 } : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.dark ? '#07130f' : '#ffffff'} />
      ) : (
        <View style={styles.buttonContent}>
          {icon ? <Ionicons color={colors.dark ? '#07130f' : '#ffffff'} name={icon} size={18} /> : null}
          <Text style={[styles.buttonText, { color: colors.dark ? '#07130f' : '#ffffff' }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function LinkButton({ title, onPress }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.linkButton}>
      <Text style={[styles.linkText, { color: colors.primary }]}>{title}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ title, loading, disabled, onPress, icon }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.secondaryButton,
        { backgroundColor: colors.surfaceStrong, borderColor: colors.borderStrong },
        pressed ? { opacity: 0.78 } : null,
        disabled || loading ? { opacity: 0.55 } : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <View style={styles.buttonContent}>
          {icon ? <Ionicons color={colors.primary} name={icon} size={18} /> : null}
          <Text style={[styles.secondaryText, { color: colors.text }]}>{title}</Text>
        </View>
      )}
    </Pressable>
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
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  error: {
    fontSize: 12,
  },
  button: {
    alignItems: 'center',
    borderRadius: 18,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: '800',
  },
  linkButton: {
    alignItems: 'center',
    minHeight: 40,
    justifyContent: 'center',
  },
  linkText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
