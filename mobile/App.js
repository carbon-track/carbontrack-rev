import React from 'react';
import { AppState, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppearanceProvider } from './src/theme';
import { I18nProvider } from './src/i18n';
import AppNavigator from './src/navigation/AppNavigator';

onlineManager.setEventListener((setOnline) => NetInfo.addEventListener((state) => {
  const isOnline = state.isConnected === true && state.isInternetReachable !== false;
  setOnline(isOnline);
}));

focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener('change', (status) => {
    if (Platform.OS !== 'web') {
      handleFocus(status === 'active');
    }
  });

  return () => subscription.remove();
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 60 * 1000,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppearanceProvider>
        <I18nProvider>
          <AppNavigator />
        </I18nProvider>
      </AppearanceProvider>
    </QueryClientProvider>
  );
}
