import React, { useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { enableScreens } from 'react-native-screens';
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

enableScreens();

const Stack = createNativeStackNavigator();
const RecordStack = createNativeStackNavigator();
const nativeTabsEnabled = !__DEV__ && Platform.OS === 'ios' && process.env.EXPO_PUBLIC_ENABLE_NATIVE_IOS_TABS === 'true';
const createTabs = () => {
  if (nativeTabsEnabled) {
    try {
      const { createNativeBottomTabNavigator } = require('@react-navigation/bottom-tabs/unstable');
      return createNativeBottomTabNavigator();
    } catch (error) {
      if (__DEV__) {
        console.warn('Native iOS tabs unavailable; using JS tabs.', error);
      }
    }
  }
  return createBottomTabNavigator();
};
const Tab = createTabs();

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
  return (
    <RecordStack.Navigator screenOptions={{ headerShown: false }}>
      <RecordStack.Screen name="RecordHome" component={RecordScreen} />
      <RecordStack.Screen name="RecordDetail" component={RecordDetailScreen} />
    </RecordStack.Navigator>
  );
}

function MainTabs() {
  const { t } = useI18n();
  const { colors, isDark } = useTheme();
  const sharedTabOptions = {
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.textMuted,
    tabBarStyle: { backgroundColor: colors.tab },
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
      sharedTabOptions.tabBarStyle,
      { borderTopColor: colors.borderStrong, elevation: 0, height: 64, paddingBottom: 8, paddingTop: 8 },
    ],
  };

  return (
    <Tab.Navigator
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
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          requiresEmailVerification ? (
            <Stack.Screen
              name="VerifyEmail"
              component={VerifyEmailScreen}
              initialParams={{ email: verificationEmail || '' }}
            />
          ) : (
            <Stack.Screen name="Main" component={MainTabs} />
          )
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
});
