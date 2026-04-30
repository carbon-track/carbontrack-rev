import React, { useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, UIManager, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import useAuthStore from '../store/authStore';
import { useI18n } from '../i18n';
import { useTheme } from '../theme';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import VerifyEmailScreen from '../screens/VerifyEmailScreen';
import HomeScreen from '../screens/HomeScreen';
import RecordScreen from '../screens/RecordScreen';
import RecordDetailScreen from '../screens/RecordDetailScreen';
import StoreScreen from '../screens/StoreScreen';
import ProfileScreen from '../screens/ProfileScreen';

const shouldUseNativeTabs = () => (
  Platform.OS === 'ios'
  && process.env.EXPO_PUBLIC_ENABLE_NATIVE_IOS_TABS === 'true'
);

const hasNativeTabsHost = () => {
  try {
    if (typeof UIManager?.hasViewManagerConfig === 'function') {
      return UIManager.hasViewManagerConfig('RNSTabsHost');
    }
    return Boolean(UIManager?.getViewManagerConfig?.('RNSTabsHost'));
  } catch {
    return false;
  }
};

const createTabs = () => {
  if (shouldUseNativeTabs() && !hasNativeTabsHost()) {
    if (__DEV__) {
      console.warn('Native iOS tabs requested, but RNSTabsHost is unavailable; using JS tabs.');
    }
  }

  if (shouldUseNativeTabs() && hasNativeTabsHost()) {
    try {
      const { createNativeBottomTabNavigator } = require('@react-navigation/bottom-tabs/unstable');
      const navigator = createNativeBottomTabNavigator();
      return { Navigator: navigator, nativeTabsEnabled: true };
    } catch (error) {
      if (__DEV__) {
        console.warn('Native iOS tabs unavailable; using JS tabs.', error);
      }
    }
  }
  return { Navigator: createBottomTabNavigator(), nativeTabsEnabled: false };
};
const { Navigator: Tab, nativeTabsEnabled } = createTabs();

const makeRoute = (params = {}) => ({ params });

const tabIcons = {
  Home: {
    native: ['house.fill', 'house'],
    fallback: ['home', 'home-outline'],
  },
  Record: {
    native: ['plus.circle.fill', 'plus.circle'],
    fallback: ['add-circle', 'add-circle-outline'],
  },
  Store: {
    native: ['bag.fill', 'bag'],
    fallback: ['bag', 'bag-outline'],
  },
  Profile: {
    native: ['person.crop.circle.fill', 'person.crop.circle'],
    fallback: ['person-circle', 'person-circle-outline'],
  },
};

function RecordStackNavigator() {
  const [detailParams, setDetailParams] = React.useState(null);
  const navigation = React.useMemo(() => ({
    navigate: (name, params) => {
      if (name === 'RecordDetail') {
        setDetailParams(params || {});
      }
    },
    goBack: () => setDetailParams(null),
  }), []);

  if (detailParams) {
    return <RecordDetailScreen navigation={navigation} route={makeRoute(detailParams)} />;
  }

  return <RecordScreen navigation={navigation} />;
}

function MainTabs() {
  const { t } = useI18n();
  const { colors, isDark } = useTheme();

  const sharedTabOptions = {
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.textMuted,
    tabBarLabelStyle: {
      fontSize: 12,
      fontWeight: '800',
    },
  };

  const nativeTabOptions = {
    headerLargeTitleEnabled: true,
    headerShadowVisible: false,
    headerStyle: { backgroundColor: 'transparent' },
    headerTransparent: true,
    headerBlurEffect: isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight',
    headerTintColor: colors.primary,
    headerTitleStyle: { color: colors.text, fontWeight: '900' },
    headerLargeTitleStyle: { color: colors.text, fontWeight: '900' },
    tabBarBlurEffect: isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight',
    tabBarControllerMode: 'tabBar',
    tabBarMinimizeBehavior: 'onScrollDown',
  };

  const fallbackTabOptions = {
    headerShown: false,
    tabBarHideOnKeyboard: true,
    tabBarStyle: [
      { backgroundColor: colors.tab },
      { borderTopColor: colors.borderStrong, elevation: 0, height: 64, paddingBottom: 8, paddingTop: 8 },
    ],
  };

  return (
    <Tab.Navigator
      detachInactiveScreens={false}
      screenOptions={({ route }) => ({
        ...sharedTabOptions,
        ...(nativeTabsEnabled ? nativeTabOptions : fallbackTabOptions),
        tabBarIcon: ({ focused, color, size }) => {
          const icons = tabIcons[route.name] || tabIcons.Home;
          if (nativeTabsEnabled) {
            const [active, inactive] = icons.native;
            return { type: 'sfSymbol', name: focused ? active : inactive };
          }
          const [active, inactive] = icons.fallback;
          return <Ionicons color={color} name={focused ? active : inactive} size={size ?? 22} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: t('tabs.home') }} />
      <Tab.Screen name="Record" component={RecordStackNavigator} options={{ title: t('tabs.record') }} />
      <Tab.Screen name="Store" component={StoreScreen} options={{ title: t('tabs.store') }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: t('tabs.profile') }} />
    </Tab.Navigator>
  );
}

function AuthFlow() {
  const [screen, setScreen] = React.useState('Login');
  const navigation = React.useMemo(() => ({
    navigate: (name) => setScreen(name),
    replace: (name) => setScreen(name),
    goBack: () => setScreen('Login'),
  }), []);

  if (screen === 'Register') {
    return <RegisterScreen navigation={navigation} />;
  }

  if (screen === 'VerifyEmail') {
    return <VerifyEmailScreen navigation={navigation} route={makeRoute()} />;
  }

  return <LoginScreen navigation={navigation} />;
}

export default function AppNavigator() {
  const { colors, isDark, isHydrated: isThemeHydrated } = useTheme();
  const { isHydrated: isI18nHydrated } = useI18n();
  const navigationTheme = isDark ? DarkTheme : DefaultTheme;
  const hydrate = useAuthStore((state) => state.hydrate);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const requiresEmailVerification = useAuthStore((state) => state.requiresEmailVerification);
  const verificationEmail = useAuthStore((state) => state.verificationEmail);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!isHydrated || !isThemeHydrated || !isI18nHydrated) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {isAuthenticated && !requiresEmailVerification ? (
        <NavigationContainer
          theme={{
            ...navigationTheme,
            colors: {
              ...navigationTheme.colors,
              background: colors.background,
              border: colors.border,
              card: colors.surfaceStrong,
              notification: colors.primary,
              primary: colors.primary,
              text: colors.text,
            },
          }}
        >
          <MainTabs />
        </NavigationContainer>
      ) : requiresEmailVerification ? (
        <VerifyEmailScreen route={makeRoute({ email: verificationEmail || '' })} />
      ) : (
        <AuthFlow />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
});
