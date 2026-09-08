const assert = require('node:assert/strict');
const test = require('node:test');

const {
  getThirdPartyMMKVImportError,
  isThirdPartyModuleOrigin,
} = require('./native-storage-metro-policy');

test('identifies third-party origins on POSIX and Windows paths', () => {
  assert.equal(
    isThirdPartyModuleOrigin('/repo/node_modules/vendor/index.js'),
    true,
  );
  assert.equal(
    isThirdPartyModuleOrigin('C:\\repo\\node_modules\\vendor\\index.js'),
    true,
  );
  assert.equal(
    isThirdPartyModuleOrigin('/repo/packages/shared/index.ts'),
    false,
  );
  assert.equal(
    isThirdPartyModuleOrigin('/repo/node_modules/@onekeyhq/shared/index.ts'),
    false,
  );
});

test('blocks root and deep third-party MMKV imports in every runtime graph', () => {
  const originModulePath = '/repo/node_modules/vendor/index.js';

  assert.match(
    getThirdPartyMMKVImportError({
      moduleName: 'react-native-mmkv',
      originModulePath,
    }),
    /Patch the package/u,
  );
  assert.match(
    getThirdPartyMMKVImportError({
      moduleName: 'react-native-mmkv/src/NativeMmkv',
      originModulePath,
    }),
    /Patch the package/u,
  );
});

test('allows first-party MMKV and unrelated third-party imports', () => {
  assert.equal(
    getThirdPartyMMKVImportError({
      moduleName: 'react-native-mmkv',
      originModulePath: '/repo/packages/shared/index.ts',
    }),
    undefined,
  );
  assert.equal(
    getThirdPartyMMKVImportError({
      moduleName: 'react-native',
      originModulePath: '/repo/node_modules/vendor/index.js',
    }),
    undefined,
  );
});
