import React from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

const TURNSTILE_HTML = \`
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
  <div class="cf-turnstile" data-sitekey="0x4AAAAAAAMmPZbIuI1n_5sF" data-callback="onToken"></div>
  <script>
    function onToken(token) {
      window.ReactNativeWebView.postMessage(token);
    }
  </script>
</body>
</html>
\`;

export default function TurnstileWidget({ onVerify }) {
  return (
    <View style={styles.container}>
      <WebView
        source={{ html: TURNSTILE_HTML }}
        onMessage={(event) => onVerify(event.nativeEvent.data)}
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
});