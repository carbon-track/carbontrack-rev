import React, { useMemo } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { useI18n } from '../i18n';
import { useTheme } from '../theme';

const SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY || '';
const TURNSTILE_BASE_URL = process.env.EXPO_PUBLIC_TURNSTILE_BASE_URL || '';
const turnstileWebViewEnabled = !__DEV__ || process.env.EXPO_PUBLIC_ENABLE_TURNSTILE_WEBVIEW === 'true';
const sanitizeSiteKey = (value) => String(value || '').replace(/[^0-9A-Za-z_-]/g, '');
const TURNSTILE_SITE_KEY = sanitizeSiteKey(SITE_KEY);

export const isTurnstileConfigured = Boolean(TURNSTILE_SITE_KEY && TURNSTILE_BASE_URL && turnstileWebViewEnabled);

const getTurnstileOrigins = () => {
  const origins = ['https://challenges.cloudflare.com', 'about:blank', 'about:srcdoc'];
  try {
    origins.unshift(new URL(TURNSTILE_BASE_URL).origin);
  } catch {
    if (TURNSTILE_BASE_URL) {
      origins.unshift(TURNSTILE_BASE_URL);
    }
  }
  return origins;
};

const buildTurnstileHtml = (siteKey) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
  <style>
    body, html { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: transparent; }
  </style>
</head>
<body>
  <div
    class="cf-turnstile"
    data-sitekey="${siteKey}"
    data-callback="onToken"
    data-expired-callback="onExpired"
    data-error-callback="onError"
  ></div>
  <script>
    function onToken(token) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'verify', token: token }));
    }
    function onExpired() {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'expire' }));
    }
    function onError() {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error' }));
    }
  </script>
</body>
</html>
`;

export default function TurnstileWidget({ onVerify, onExpire, onError, resetKey }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const html = useMemo(() => buildTurnstileHtml(TURNSTILE_SITE_KEY), []);

  if (!isTurnstileConfigured) {
    return (
      <View style={[styles.container, styles.missing, { borderColor: colors.warning, backgroundColor: colors.surfaceMuted }]}>
        <Text style={[styles.missingText, { color: colors.warning }]}>{t('turnstile.missingConfig')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        key={resetKey}
        source={{ html, baseUrl: TURNSTILE_BASE_URL }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        setSupportMultipleWindows={false}
        originWhitelist={getTurnstileOrigins()}
        onMessage={(event) => {
          try {
            const payload = JSON.parse(event.nativeEvent.data);
            if (payload.type === 'verify') {
              onVerify?.(payload.token);
            } else if (payload.type === 'expire') {
              onExpire?.();
            } else if (payload.type === 'error') {
              onError?.();
            }
          } catch {
            onVerify?.(event.nativeEvent.data);
          }
        }}
        style={{ backgroundColor: 'transparent' }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 100,
    width: '100%',
    overflow: 'hidden',
  },
  missing: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 16,
  },
  missingText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
