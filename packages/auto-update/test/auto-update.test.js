const test = require('node:test');
const assert = require('node:assert/strict');

const { setupAutoUpdate, quitAndInstall } = require('..');

test('exports the wiring functions', () => {
  assert.equal(typeof setupAutoUpdate, 'function');
  assert.equal(typeof quitAndInstall, 'function');
});

test('setupAutoUpdate is inert when disabled (dev runs)', () => {
  assert.equal(setupAutoUpdate({ isEnabled: () => false }), null);
});

test('setupAutoUpdate tolerates a missing electron-updater', () => {
  let seen = null;
  const result = setupAutoUpdate({
    isEnabled: () => true,
    onError: (error) => {
      seen = error;
    }
  });
  assert.equal(result, null);
  assert.ok(seen instanceof Error, 'missing electron-updater surfaces through onError');
});
