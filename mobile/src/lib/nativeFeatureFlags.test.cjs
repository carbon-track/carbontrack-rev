const assert = require('node:assert/strict');
const test = require('node:test');

const {
  isEnabledByDefault,
  isNativeIosTabsEnabled,
  isNativeLiquidGlassEnabled,
} = require('./nativeFeatureFlags');

test('native feature flags stay enabled when production build env omits them', () => {
  assert.equal(isNativeIosTabsEnabled({}), true);
  assert.equal(isNativeLiquidGlassEnabled({}), true);
});

test('native feature flags can be explicitly disabled for old binaries', () => {
  for (const value of ['false', 'FALSE', '0', 'off', 'disabled', false, 0]) {
    assert.equal(isEnabledByDefault(value), false);
  }
});

test('native feature flags treat truthy deployment values as enabled', () => {
  for (const value of ['true', '1', 'yes', 'on', 'enabled', true, 1]) {
    assert.equal(isEnabledByDefault(value), true);
  }
});
