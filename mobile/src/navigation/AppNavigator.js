import React, { useEffect } from 'react';
import { ActivityIndicator, BackHandler, Platform, StyleSheet, UIManager, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import useAuthStore from '../store/authStore';
import { useI18n } from '../i18n';
import { useTheme } from '../theme';
import { isNativeIosTabsEnabled } from '../lib/nativeFeatureFlags';
import { useEdgeSwipeBack } from '../lib/navigationGestures';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import VerifyEmailScreen from '../screens/VerifyEmailScreen';
import HomeScreen from '../screens/HomeScreen';
import MessagesScreen from '../screens/MessagesScreen';
import RecordScreen from '../screens/RecordScreen';
import RecordDetailScreen from '../screens/RecordDetailScreen';
import StoreScreen from '../screens/StoreScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ProfileSettingsScreen from '../screens/ProfileSettingsScreen';

const shouldUseNativeTabs = () => (
  Platform.OS === 'ios'
  && isNativeIosTabsEnabled()
);

const hasNativeTabsHost = () => {
  try {
    const screens = require('react-native-screens');
    if (!screens?.BottomTabs || !screens?.BottomTabsScreen) {
      return false;
    }

    const nativeComponentNames = ['RNSBottomTabs', 'RNSBottomTabsScreen'];
    if (typeof UIManager?.hasViewManagerConfig === 'function') {
      return nativeComponentNames.every((name) => UIManager.hasViewManagerConfig(name));
    }
    return nativeComponentNames.every((name) => Boolean(UIManager?.getViewManagerConfig?.(name)));
  } catch {
    return false;
  }
};

const createTabs = () => {
  const nativeTabsRequested = shouldUseNativeTabs();
  const nativeTabsHostAvailable = nativeTabsRequested && hasNativeTabsHost();

  if (nativeTabsRequested && !nativeTabsHostAvailable) {
    if (__DEV__) {
      console.warn('Native iOS tabs requested, but RNSTabsHost is unavailable; using JS tabs.');
    }
  }

  if (nativeTabsHostAvailable) {
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
  Messages: {
    native: ['envelope.fill', 'envelope'],
    fallback: ['mail', 'mail-outline'],
  },
  Profile: {
    native: ['person.crop.circle.fill', 'person.crop.circle'],
    fallback: ['person-circle', 'person-circle-outline'],
  },
};

function RecordStackNavigator({ navigation: tabNavigation, route }) {
  const [detailParams, setDetailParams] = React.useState(null);
  const navigation = React.useMemo(() => ({
    navigate: (name, params) => {
      if (name === 'RecordDetail') {
        setDetailParams(params || {});
        return;
      }
      tabNavigation?.navigate?.(name, params);
    },
    goBack: () => setDetailParams(null),
  }), [tabNavigation]);
  const detailSwipeBack = useEdgeSwipeBack(navigation);

  React.useEffect(() => {
    if (route?.params?.detailRecord) {
      setDetailParams(route.params.detailRecord);
    }
  }, [route?.params?.detailRecord]);

  React.useEffect(() => {
    if (!detailParams) {
      return undefined;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.goBack();
      return true;
    });
    return () => subscription.remove();
  }, [detailParams, navigation]);

  if (detailParams) {
    return (
      <View style={styles.stackHost}>
        <View pointerEvents="none" style={styles.stackLayer}>
          <RecordScreen navigation={navigation} route={makeRoute(route?.params || {})} />
        </View>
        <View style={styles.stackLayer}>
          <RecordDetailScreen navigation={navigation} route={makeRoute(detailParams)} swipeBack={detailSwipeBack} />
        </View>
      </View>
    );
  }

  return <RecordScreen navigation={navigation} route={makeRoute(route?.params || {})} />;
}

function ProfileStackNavigator({ navigation: tabNavigation, route }) {
  const [settingsParams, setSettingsParams] = React.useState(null);
  const navigation = React.useMemo(() => ({
    navigate: (name, params) => {
      if (name === 'ProfileSettings') {
        setSettingsParams(params || {});
        return;
      }
      tabNavigation?.navigate?.(name, params);
    },
    goBack: () => setSettingsParams(null),
  }), [tabNavigation]);
  const settingsSwipeBack = useEdgeSwipeBack(navigation);

  React.useEffect(() => {
    if (route?.params?.settings) {
      setSettingsParams(route.params.settings);
    }
  }, [route?.params?.settings]);

  React.useEffect(() => {
    if (!settingsParams) {
      return undefined;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.goBack();
      return true;
    });
    return () => subscription.remove();
  }, [navigation, settingsParams]);

  if (settingsParams) {
    return (
      <View style={styles.stackHost}>
        <View pointerEvents="none" style={styles.stackLayer}>
          <ProfileScreen navigation={navigation} route={makeRoute(route?.params || {})} />
        </View>
        <View style={styles.stackLayer}>
          <ProfileSettingsScreen navigation={navigation} route={makeRoute(settingsParams)} swipeBack={settingsSwipeBack} />
        </View>
      </View>
    );
  }

  return <ProfileScreen navigation={navigation} route={makeRoute(route?.params || {})} />;
}

function MainTabs() {
  const { t } = useI18n();
  const { colors, isDark } = useTheme();
  const { Navigator: Tab, nativeTabsEnabled } = React.useMemo(createTabs, []);

  const sharedTabOptions = {
    lazy: false,
    sceneStyle: {
      backgroundColor: colors.background,
    },
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.textMuted,
    tabBarLabelStyle: {
      fontSize: 12,
      fontWeight: '800',
    },
  };

  const nativeTabOptions = {
    headerShown: false,
    tabBarBlurEffect: isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight',
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
            const name = focused ? active : inactive;
            return { type: 'sfSymbol', name, sfSymbolName: name };
          }
          const [active, inactive] = icons.fallback;
          return <Ionicons color={color} name={focused ? active : inactive} size={size ?? 22} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: t('tabs.home') }} />
      <Tab.Screen name="Record" component={RecordStackNavigator} options={{ title: t('tabs.record') }} />
      <Tab.Screen name="Store" component={StoreScreen} options={{ title: t('tabs.store') }} />
      <Tab.Screen name="Messages" component={MessagesScreen} options={{ title: t('tabs.messages') }} />
      <Tab.Screen name="Profile" component={ProfileStackNavigator} options={{ title: t('tabs.profile') }} />
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
    <View style={[styles.appRoot, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {isAuthenticated && !requiresEmailVerification ? (
        <NavigationContainer
          theme={{
            ...navigationTheme,
            colors: {
              ...navigationTheme.colors,
              background: colors.background,
              border: colors.border,
              card: colors.background,
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
    </View>
  );
}

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
  },
  loading: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  stackHost: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  stackLayer: {
    ...StyleSheet.absoluteFillObject,
  },
});
