const disabledValues = new Set(['0', 'false', 'no', 'off', 'disabled']);

const isEnabledByDefault = (value) => {
  if (value === false || value === 0) {
    return false;
  }

  if (value == null) {
    return true;
  }

  const normalized = String(value).trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return !disabledValues.has(normalized);
};

const isNativeIosTabsEnabled = (env = process.env) => (
  isEnabledByDefault(env?.EXPO_PUBLIC_ENABLE_NATIVE_IOS_TABS)
);

const isNativeLiquidGlassEnabled = (env = process.env) => (
  isEnabledByDefault(env?.EXPO_PUBLIC_ENABLE_NATIVE_LIQUID_GLASS)
);

module.exports = {
  isEnabledByDefault,
  isNativeIosTabsEnabled,
  isNativeLiquidGlassEnabled,
};
