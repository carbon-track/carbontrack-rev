import React, { useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createNativeBottomTabNavigator } from '@react-navigation/bottom-tabs/unstable';
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
import StoreScreen from '../screens/StoreScreen';
import ProfileScreen from '../screens/ProfileScreen';

enableScreens();

const Stack = createNativeStackNavigator();
const Tab = createNativeBottomTabNavigator();

const tabIcons = {
  Home: ['house.fill', 'house'],
  Record: ['plus.circle.fill', 'plus.circle'],
  Store: ['bag.fill', 'bag'],
  Profile: ['person.crop.circle.fill', 'person.crop.circle'],
};

function MainTabs() {
  const { t } = useI18n();
  const { colors, isDark } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerLargeTitleEnabled: true,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: 'transparent' },
        headerTransparent: Platform.OS === 'ios',
        headerBlurEffect: isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight',
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text, fontWeight: '900' },
        headerLargeTitleStyle: { color: colors.text, fontWeight: '900' },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarBlurEffect: isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight',
        tabBarControllerMode: 'tabBar',
        tabBarMinimizeBehavior: 'onScrollDown',
        tabBarStyle: { backgroundColor: colors.tab },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '800',
        },
        tabBarIcon: ({ focused }) => {
          const [active, inactive] = tabIcons[route.name] || tabIcons.Home;
          return Platform.OS === 'ios' ? { type: 'sfSymbol', name: focused ? active : inactive } : undefined;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: t('tabs.home') }} />
      <Tab.Screen name="Record" component={RecordScreen} options={{ title: t('tabs.record') }} />
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
