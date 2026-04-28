import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export function Field({ label, error, ...inputProps }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        placeholderTextColor="#94a3b8"
        style={[styles.input, error ? styles.inputError : null, inputProps.style]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function PrimaryButton({ title, loading, disabled, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        pressed ? styles.buttonPressed : null,
        disabled || loading ? styles.buttonDisabled : null,
      ]}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{title}</Text>}
    </Pressable>
  );
}

export function LinkButton({ title, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.linkButton}>
      <Text style={styles.linkText}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 6,
  },
  label: {
    color: '#14532d',
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#fff',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    color: '#0f172a',
    minHeight: 46,
    paddingHorizontal: 12,
  },
  inputError: {
    borderColor: '#dc2626',
  },
  error: {
    color: '#dc2626',
    fontSize: 12,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#16a34a',
    borderRadius: 8,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonPressed: {
    backgroundColor: '#15803d',
  },
  buttonDisabled: {
    backgroundColor: '#86efac',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  linkButton: {
    alignItems: 'center',
    minHeight: 40,
    justifyContent: 'center',
  },
  linkText: {
    color: '#15803d',
    fontSize: 15,
    fontWeight: '600',
  },
});
