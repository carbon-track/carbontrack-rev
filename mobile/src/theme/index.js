import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const THEME_KEY = 'carbonrack.appearance.theme';
const DEFAULT_THEME_MODE = 'system';

export const themeOptions = [
  { value: 'system', labelKey: 'appearance.system' },
  { value: 'light', labelKey: 'appearance.light' },
  { value: 'dark', labelKey: 'appearance.dark' },
];

const palette = {
  light: {
    dark: false,
    background: '#edf7f1',
    backgroundAlt: '#f8fbf8',
    text: '#10231a',
    textMuted: '#5f6f67',
    primary: '#12814f',
    primaryPressed: '#0c6f42',
    primarySoft: 'rgba(18, 129, 79, 0.14)',
    surface: 'rgba(255, 255, 255, 0.62)',
    surfaceStrong: 'rgba(255, 255, 255, 0.82)',
    surfaceMuted: 'rgba(241, 248, 244, 0.68)',
    border: 'rgba(255, 255, 255, 0.72)',
    borderStrong: 'rgba(78, 124, 98, 0.22)',
    input: 'rgba(255, 255, 255, 0.72)',
    danger: '#dc2626',
    warning: '#b45309',
    shadow: '#2f5f48',
    tab: 'rgba(255, 255, 255, 0.78)',
  },
  dark: {
    dark: true,
    background: '#07130f',
    backgroundAlt: '#0b1d16',
    text: '#eef8f1',
    textMuted: '#9bb1a4',
    primary: '#6ee7a8',
    primaryPressed: '#4ade80',
    primarySoft: 'rgba(110, 231, 168, 0.18)',
    surface: 'rgba(19, 40, 30, 0.56)',
    surfaceStrong: 'rgba(18, 44, 32, 0.82)',
    surfaceMuted: 'rgba(11, 29, 22, 0.72)',
    border: 'rgba(255, 255, 255, 0.12)',
    borderStrong: 'rgba(156, 196, 172, 0.24)',
    input: 'rgba(14, 34, 25, 0.78)',
    danger: '#f87171',
    warning: '#fbbf24',
    shadow: '#000000',
    tab: 'rgba(13, 32, 24, 0.84)',
  },
};

const ThemeContext = createContext(null);

const normalizeThemeMode = (value) => {
  if (value === 'light' || value === 'dark' || value === 'system') {
    return value;
  }
  return DEFAULT_THEME_MODE;
};

export function AppearanceProvider({ children }) {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState(DEFAULT_THEME_MODE);
  const [isHydrated, setIsHydrated] = useState(false);
  const resolvedTheme = themeMode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : themeMode;
  const colors = palette[resolvedTheme];

  useEffect(() => {
    let mounted = true;
    SecureStore.getItemAsync(THEME_KEY)
      .then((stored) => {
        if (mounted) {
          setThemeModeState(normalizeThemeMode(stored));
        }
      })
      .finally(() => {
        if (mounted) {
          setIsHydrated(true);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const setThemeMode = useCallback(async (nextMode) => {
    const mode = normalizeThemeMode(nextMode);
    setThemeModeState(mode);
    await SecureStore.setItemAsync(THEME_KEY, mode);
  }, []);

  const value = useMemo(() => ({
    colors,
    isDark: resolvedTheme === 'dark',
    isHydrated,
    resolvedTheme,
    setThemeMode,
    themeMode,
  }), [colors, isHydrated, resolvedTheme, setThemeMode, themeMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used inside AppearanceProvider');
  }
  return context;
}

export function makeShadow(colors, opacity = 0.18, elevation = 12) {
  return {
    elevation,
    shadowColor: colors.shadow,
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: opacity,
    shadowRadius: 24,
  };
}
