const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const packageRoot = path.dirname(
  require.resolve('@onekeyfe/react-native-native-list/package.json'),
);
const validation = import(
  pathToFileURL(path.join(packageRoot, 'lib/module/validation.js')).href
);

test('preserves account avatars through snapshot and row patch validation', async (t) => {
  const { validateSnapshot, validatePatches } = await validation;
  const originalDev = globalThis.__DEV__;
  t.after(() => {
    globalThis.__DEV__ = originalDev;
  });

  for (const development of [false, true]) {
    globalThis.__DEV__ = development;
    for (const uri of [
      'onekey-avatar://blockie/v1/testaccount0',
      `onekey-avatar://blockie/v1/${encodeURIComponent('account/with spaces')}`,
    ]) {
      const leading = {
        kind: 'account',
        image: { uri, width: 32, height: 32 },
        fallbackIcon: { name: 'CrossedSmallSolid' },
      };
      const snapshot = validateSnapshot({
        schemaVersion: 1,
        generation: 1,
        layout: { kind: 'linear' },
        rows: [{ type: 'identity', key: 'account', title: 'Account', leading }],
      });
      assert.deepEqual(snapshot.rows[0].leading.image, leading.image);

      const patches = validatePatches([
        { type: 'identity', key: 'account', changes: { leading } },
      ]);
      assert.deepEqual(patches[0].changes.leading.image, leading.image);
    }
  }
});

test('continues filtering unsupported image protocols and blockie paths', async () => {
  const { validateSnapshot } = await validation;
  for (const uri of [
    // eslint-disable-next-line no-script-url -- Verify that executable URLs remain rejected.
    'javascript:alert(1)',
    'onekey-avatar://other/v1/account',
    'onekey-avatar://blockie/v2/account',
    'onekey-avatar://blockie/v1/',
    'onekey-avatar://blockie/v1/account/extra',
    'onekey-avatar://blockie/v1/account?query',
    'onekey-avatar://blockie/v1/account#fragment',
  ]) {
    const snapshot = validateSnapshot({
      schemaVersion: 1,
      generation: 1,
      layout: { kind: 'linear' },
      rows: [
        {
          type: 'identity',
          key: 'account',
          title: 'Account',
          leading: { kind: 'account', image: { uri, width: 32, height: 32 } },
        },
      ],
    });
    assert.equal(snapshot.rows[0].leading.image, undefined);
  }
});
