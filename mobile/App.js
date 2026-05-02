import React from 'react';
import { AppState, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppearanceProvider } from './src/theme';
import { I18nProvider } from './src/i18n';
import AppNavigator from './src/navigation/AppNavigator';

const APP_DATA_REFRESH_INTERVAL_MS = 2 * 60 * 1000;

onlineManager.setEventListener((setOnline) => NetInfo.addEventListener((state) => {
  const isOnline = state.isConnected === true && state.isInternetReachable !== false;
  setOnline(isOnline);
}));

if (Platform.OS !== 'web') {
  focusManager.setEventListener((handleFocus) => {
    const subscription = AppState.addEventListener('change', (status) => {
      handleFocus(status === 'active');
    });

    return () => subscription.remove();
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: APP_DATA_REFRESH_INTERVAL_MS,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
    },
  },
});

const getLatestDataRefreshAt = () => (
  queryClient
    .getQueryCache()
    .findAll()
    .reduce((latest, query) => Math.max(latest, query.state.dataUpdatedAt || 0), 0)
);

function AppDataRefreshGate() {
  const refreshingRef = React.useRef(false);

  const refreshIfStale = React.useCallback(() => {
    if (refreshingRef.current) {
      return;
    }

    const latestRefreshAt = getLatestDataRefreshAt();
    if (latestRefreshAt && Date.now() - latestRefreshAt < APP_DATA_REFRESH_INTERVAL_MS) {
      return;
    }

    refreshingRef.current = true;
    Promise.resolve(queryClient.invalidateQueries({ refetchType: 'all' }))
      .finally(() => {
        refreshingRef.current = false;
      });
  }, []);

  React.useEffect(() => {
    refreshIfStale();

    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        refreshIfStale();
      }
    });

    return () => subscription.remove();
  }, [refreshIfStale]);

  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppDataRefreshGate />
      <AppearanceProvider>
        <I18nProvider>
          <AppNavigator />
        </I18nProvider>
      </AppearanceProvider>
    </QueryClientProvider>
  );
}
