import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const DEVICE_ID_KEY = 'carbontrack.mobile.deviceId';

const makeDeviceId = () => {
  if (typeof Crypto.randomUUID === 'function') {
    return Crypto.randomUUID();
  }
  return `${Platform.OS}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const getMobileDeviceSessionPayload = async () => {
  let deviceId = null;
  try {
    deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = makeDeviceId();
      await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
    }
  } catch (error) {
    console.warn('Mobile device id persistence failed; using a transient id.', {
      code: error?.code ?? null,
      message: error?.message ?? 'unknown',
    });
    deviceId = makeDeviceId();
  }

  return {
    client_type: 'mobile',
    device_id: deviceId,
    device_name: Platform.select({
      ios: 'iOS device',
      android: 'Android device',
      default: 'Mobile device',
    }),
    platform: Platform.OS,
  };
};
