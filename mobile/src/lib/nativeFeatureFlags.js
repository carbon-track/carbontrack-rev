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

const isNativeIosTabsEnabled = (env = process.env) => (
  parseBooleanFlag(env?.EXPO_PUBLIC_ENABLE_NATIVE_IOS_TABS)
);

const isNativeLiquidGlassEnabled = (env = process.env) => (
  parseBooleanFlag(env?.EXPO_PUBLIC_ENABLE_NATIVE_LIQUID_GLASS)
);

module.exports = {
  parseBooleanFlag,
  isNativeIosTabsEnabled,
  isNativeLiquidGlassEnabled,
};
