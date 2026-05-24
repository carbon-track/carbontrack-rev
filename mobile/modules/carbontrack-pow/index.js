import { requireNativeModule } from 'expo';

let CarbonTrackPow = null;

try {
  CarbonTrackPow = requireNativeModule('CarbonTrackPow');
} catch {
  CarbonTrackPow = null;
}

export default CarbonTrackPow;
