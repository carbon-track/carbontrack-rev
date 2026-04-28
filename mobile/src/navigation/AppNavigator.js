import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
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
const Tab = createBottomTabNavigator();

const tabIcons = {
  Home: ['home', 'home-outline'],
  Record: ['add-circle', 'add-circle-outline'],
  Store: ['storefront', 'storefront-outline'],
  Profile: ['person', 'person-outline'],
};

function MainTabs() {
  const { t } = useI18n();
  const { colors, isDark } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.text, fontWeight: '900' },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.tab,
          borderColor: colors.border,
          borderRadius: 24,
          borderTopWidth: 1,
          bottom: 12,
          height: 68,
          marginHorizontal: 14,
          paddingBottom: 10,
          paddingTop: 8,
          position: 'absolute',
        },
        tabBarBackground: () => (
          <BlurView intensity={42} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />
        ),
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '800',
        },
        tabBarIcon: ({ color, focused, size }) => {
          const [active, inactive] = tabIcons[route.name] || tabIcons.Home;
          return <Ionicons color={color} name={focused ? active : inactive} size={size} />;
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
