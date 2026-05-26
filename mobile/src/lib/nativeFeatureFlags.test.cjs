const assert = require('node:assert/strict');
const test = require('node:test');

const {
  parseBooleanFlag,
  isNativeIosTabsEnabled,
  isNativeLiquidGlassEnabled,
} = require('./nativeFeatureFlags');

test('native feature flags stay disabled unless explicitly enabled', () => {
  assert.equal(isNativeIosTabsEnabled({}), false);
  assert.equal(isNativeLiquidGlassEnabled({}), false);
  assert.equal(parseBooleanFlag(''), false);
  assert.equal(parseBooleanFlag('unexpected'), false);
});

test('native feature flags can be explicitly disabled for old binaries', () => {
  for (const value of ['false', 'FALSE', '0', 'off', 'disabled', false, 0]) {
    assert.equal(parseBooleanFlag(value), false);
  }
});

test('native feature flags treat truthy deployment values as enabled', () => {
  for (const value of ['true', '1', 'yes', 'on', 'enabled', true, 1]) {
    assert.equal(parseBooleanFlag(value), true);
  }
});
