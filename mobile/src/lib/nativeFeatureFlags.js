const disabledValues = new Set(['0', 'false', 'no', 'off', 'disabled']);
const enabledValues = new Set(['1', 'true', 'yes', 'on', 'enabled']);

const parseBooleanFlag = (value) => {
  if (value === true || value === 1) {
    return true;
  }

  if (value === false || value === 0 || value == null) {
    return false;
  }

  const normalized = String(value).trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return enabledValues.has(normalized) && !disabledValues.has(normalized);
};

const nativeIosTabsEnvValue = process.env.EXPO_PUBLIC_ENABLE_NATIVE_IOS_TABS;
const nativeLiquidGlassEnvValue = process.env.EXPO_PUBLIC_ENABLE_NATIVE_LIQUID_GLASS;

const isNativeIosTabsEnabled = (env) => (
  parseBooleanFlag(env ? env.EXPO_PUBLIC_ENABLE_NATIVE_IOS_TABS : nativeIosTabsEnvValue)
);

const isNativeLiquidGlassEnabled = (env) => (
  parseBooleanFlag(env ? env.EXPO_PUBLIC_ENABLE_NATIVE_LIQUID_GLASS : nativeLiquidGlassEnvValue)
);

module.exports = {
  parseBooleanFlag,
  isNativeIosTabsEnabled,
  isNativeLiquidGlassEnabled,
};
