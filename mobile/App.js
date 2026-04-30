import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppearanceProvider } from './src/theme';
import { I18nProvider } from './src/i18n';
import AppNavigator from './src/navigation/AppNavigator';

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
