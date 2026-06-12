import { requireNativeModule } from 'expo-modules-core';

let CarbonTrackPow = null;

try {
  CarbonTrackPow = requireNativeModule('CarbonTrackPow');
} catch {
  CarbonTrackPow = null;
}

export default CarbonTrackPow;
