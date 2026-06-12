const test = require('node:test');
const assert = require('node:assert/strict');

const {
  hasLeadingZeroBits,
  sha256Hex,
  solveProofOfWork,
} = require('./powCore.cjs');

test('sha256Hex matches a known digest', () => {
  assert.equal(
    sha256Hex('CarbonTrack'),
    'a8ac95ba6a84d772e391683795e45e790ee82a7a6b2924e0f075ecb3cec80aa8',
  );
});

test('hasLeadingZeroBits validates difficulty against digest hex', () => {
  assert.equal(hasLeadingZeroBits('00ff', 8), true);
  assert.equal(hasLeadingZeroBits('0fff', 8), false);
  assert.equal(hasLeadingZeroBits('0fff', 4), true);
});

test('solveProofOfWork finds a nonce satisfying the challenge difficulty', async () => {
  const result = await solveProofOfWork('unit-test-challenge', 8, {
    maxAttempts: 2000,
    timeoutMs: 5000,
  });

  assert.equal(typeof result.nonce, 'number');
  assert.equal(hasLeadingZeroBits(sha256Hex(`unit-test-challenge:${result.nonce}`), 8), true);
});
