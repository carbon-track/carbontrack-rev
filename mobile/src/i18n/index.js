import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as Localization from 'expo-localization';
import * as SecureStore from 'expo-secure-store';
import en from './locales/en.json';
import zh from './locales/zh.json';

const LANGUAGE_KEY = 'carbonrack.appearance.language';
const DEFAULT_LANGUAGE_MODE = 'system';
const DEFAULT_LANGUAGE = 'en';

const dictionaries = { en, zh };
const I18nContext = createContext(null);

export const languageOptions = [
  { value: 'system', labelKey: 'appearance.system' },
  { value: 'en', labelKey: 'appearance.english' },
  { value: 'zh', labelKey: 'appearance.chinese' },
];

const normalizeLanguage = (value) => {
  const language = String(value || '').toLowerCase();
  if (language.startsWith('zh')) {
    return 'zh';
  }
  if (language.startsWith('en')) {
    return 'en';
  }
  return DEFAULT_LANGUAGE;
};

const getSystemLanguage = () => {
  const locales = typeof Localization.getLocales === 'function' ? Localization.getLocales() : [];
  const first = locales[0] || {};
  return normalizeLanguage(first.languageTag || first.languageCode);
};

const getPath = (source, key) => key.split('.').reduce((value, part) => value?.[part], source);

const interpolate = (value, params) => {
  if (typeof value !== 'string') {
    return value;
  }
  return value.replace(/\{\{(\w+)\}\}/g, (_, name) => String(params?.[name] ?? ''));
};

export function I18nProvider({ children }) {
  const [languageMode, setLanguageModeState] = useState(DEFAULT_LANGUAGE_MODE);
  const [isHydrated, setIsHydrated] = useState(false);
  const systemLanguage = getSystemLanguage();
  const resolvedLanguage = languageMode === 'system' ? systemLanguage : normalizeLanguage(languageMode);

  useEffect(() => {
    let mounted = true;
    SecureStore.getItemAsync(LANGUAGE_KEY)
      .then((stored) => {
        if (!mounted) {
          return;
        }
        if (stored === 'system' || dictionaries[stored]) {
          setLanguageModeState(stored);
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

  const setLanguageMode = useCallback(async (nextMode) => {
    const mode = nextMode === 'system' || dictionaries[nextMode] ? nextMode : DEFAULT_LANGUAGE_MODE;
    setLanguageModeState(mode);
    await SecureStore.setItemAsync(LANGUAGE_KEY, mode);
  }, []);

  const t = useCallback((key, params) => {
    const value = getPath(dictionaries[resolvedLanguage], key) ?? getPath(dictionaries[DEFAULT_LANGUAGE], key) ?? key;
    return interpolate(value, params);
  }, [resolvedLanguage]);

  const value = useMemo(() => ({
    isHydrated,
    languageMode,
    resolvedLanguage,
    systemLanguage,
    setLanguageMode,
    t,
  }), [isHydrated, languageMode, resolvedLanguage, setLanguageMode, systemLanguage, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider');
  }
  return context;
}
