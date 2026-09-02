const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  ASYNC_STORAGE_PACKAGE,
  MMKV_PACKAGE,
  SUPPORTED_ASYNC_STORAGE_METHODS,
  analyzeSource,
  scanMobileProductionDependencies,
} = require('./check-third-party-async-storage');

function analyze(source, filePath = 'fixture.js') {
  return analyzeSource({ filePath, source });
}

function violationCodes(result) {
  return result.violations.map((violation) => violation.code);
}

test('allows every AsyncStorage public method exposed by the bg proxy', () => {
  const calls = [...SUPPORTED_ASYNC_STORAGE_METHODS]
    .map((method) => `AsyncStorage.${method};`)
    .join('\n');
  const result = analyze(
    `import AsyncStorage from '${ASYNC_STORAGE_PACKAGE}';\n${calls}`,
    'fixture.ts',
  );

  assert.deepEqual(result.violations, []);
  assert.deepEqual(
    result.methods,
    [...SUPPORTED_ASYNC_STORAGE_METHODS].toSorted(),
  );
});

test('allows the current WalletConnect CommonJS default interop shape', () => {
  const result = analyze(`
    var imported = require('${ASYNC_STORAGE_PACKAGE}');
    function interop(value) {
      return value && value.__esModule ? value : { default: value };
    }
    var storageModule = interop(imported);
    class Storage {
      constructor() {
        this.asyncStorage = storageModule.default;
      }
      getKeys() {
        return this.asyncStorage.getAllKeys();
      }
      getEntries() {
        return this.asyncStorage.multiGet(['key']);
      }
      getItem() {
        return this.asyncStorage.getItem('key');
      }
      setItem() {
        return this.asyncStorage.setItem('key', 'value');
      }
      removeItem() {
        return this.asyncStorage.removeItem('key');
      }
    }
  `);

  assert.deepEqual(result.violations, []);
  assert.deepEqual(result.methods, [
    'getAllKeys',
    'getItem',
    'multiGet',
    'removeItem',
    'setItem',
  ]);
});

test('rejects unsupported APIs behind a separated CommonJS interop call', () => {
  const result = analyze(`
    var imported = require('${ASYNC_STORAGE_PACKAGE}');
    var storageModule = interop(imported);
    storageModule.default.useAsyncStorage('key');
  `);

  assert.deepEqual(violationCodes(result), ['unsupported-api']);
});

test('rejects runtime imports whose API surface cannot be verified', () => {
  const result = analyze(`
    import AsyncStorage from '${ASYNC_STORAGE_PACKAGE}';
    configureStorage(AsyncStorage);
  `);

  assert.deepEqual(violationCodes(result), ['unverified-api-surface']);
});

test('rejects escaped storage objects even when another API call is supported', () => {
  const defaultEscape = analyze(`
    import AsyncStorage from '${ASYNC_STORAGE_PACKAGE}';
    AsyncStorage.getItem('key');
    configureStorage(AsyncStorage);
  `);
  const moduleEscape = analyze(`
    var imported = require('${ASYNC_STORAGE_PACKAGE}');
    var storageModule = interop(imported);
    storageModule.default.getItem('key');
    configureStorageModule(storageModule);
  `);

  assert.ok(violationCodes(defaultEscape).includes('unverified-api-surface'));
  assert.ok(violationCodes(moduleEscape).includes('unverified-api-surface'));
});

test('allows the current Reown compiled CommonJS default interop shape', () => {
  const result = analyze(`
    var storageModule = interopRequireDefault(
      require('${ASYNC_STORAGE_PACKAGE}')
    );
    storageModule.default.getItem('key');
    storageModule.default.setItem('key', 'value');
    storageModule.default.removeItem('key');
  `);

  assert.deepEqual(result.violations, []);
  assert.deepEqual(result.methods, ['getItem', 'removeItem', 'setItem']);
});

test('allows type-only imports because Metro erases them', () => {
  const asyncStorageResult = analyze(
    `import type { AsyncStorageStatic } from '${ASYNC_STORAGE_PACKAGE}/lib/typescript/types';`,
    'fixture.ts',
  );
  const mmkvResult = analyze(
    `import type { MMKV } from '${MMKV_PACKAGE}';`,
    'fixture.ts',
  );

  assert.deepEqual(asyncStorageResult.violations, []);
  assert.deepEqual(mmkvResult.violations, []);
});

test('rejects all third-party MMKV runtime import shapes', () => {
  const cases = [
    `import { createMMKV } from '${MMKV_PACKAGE}';`,
    `const MMKV = require('${MMKV_PACKAGE}');`,
    `export * from '${MMKV_PACKAGE}';`,
    `async function load() { return import('${MMKV_PACKAGE}/src/index'); }`,
    `const packageName = '${MMKV_PACKAGE}'; require(packageName);`,
  ];

  for (const source of cases) {
    assert.ok(
      violationCodes(analyze(source)).includes('third-party-mmkv-import'),
      source,
    );
  }
});

test('rejects imports that cannot be redirected to the proxy', () => {
  const cases = [
    `import Storage from '${ASYNC_STORAGE_PACKAGE}/src/NativeAsyncStorage';`,
    `import { getItem } from '${ASYNC_STORAGE_PACKAGE}';`,
    `import * as Storage from '${ASYNC_STORAGE_PACKAGE}';`,
    `const Storage = require('@react-native-community/async-storage');`,
    `const Storage = require('@onekeyfe/react-native-async-storage');`,
  ];

  for (const source of cases) {
    assert.notDeepEqual(analyze(source).violations, [], source);
  }
});

test('rejects unsupported proxy methods and raw CommonJS namespace access', () => {
  const unsupportedMethod = analyze(`
    import AsyncStorage from '${ASYNC_STORAGE_PACKAGE}';
    AsyncStorage.useAsyncStorage('key');
  `);
  const rawCommonJs = analyze(`
    const AsyncStorage = require('${ASYNC_STORAGE_PACKAGE}');
    AsyncStorage.getItem('key');
  `);

  assert.deepEqual(violationCodes(unsupportedMethod), ['unsupported-api']);
  assert.deepEqual(violationCodes(rawCommonJs), ['commonjs-namespace-access']);
});

test('rejects legacy react-native and direct native-module access', () => {
  const namedImport = analyze(
    `import { AsyncStorage } from 'react-native'; AsyncStorage.getItem('key');`,
  );
  const namespaceImport = analyze(
    `import * as ReactNative from 'react-native'; ReactNative.AsyncStorage.getItem('key');`,
  );
  const commonJsImport = analyze(
    `const { AsyncStorage } = require('react-native'); AsyncStorage.getItem('key');`,
  );
  const nativeModulesImport = analyze(
    `import { NativeModules } from 'react-native'; NativeModules.AsyncStorage.getItem('key');`,
  );
  const nativeModule = analyze(
    `NativeModules.RNCAsyncStorage.multiGet(['key']);`,
  );

  assert.ok(violationCodes(namedImport).includes('legacy-react-native-api'));
  assert.ok(
    violationCodes(namespaceImport).includes('legacy-react-native-api'),
  );
  assert.ok(violationCodes(commonJsImport).includes('legacy-react-native-api'));
  assert.ok(
    violationCodes(nativeModulesImport).includes('legacy-react-native-api'),
  );
  assert.ok(violationCodes(nativeModule).includes('native-module-access'));
});

test('rejects dynamic package references and dynamic imports', () => {
  const dynamicReference = analyze(`
    const storagePackage = '${ASYNC_STORAGE_PACKAGE}';
    require(storagePackage);
  `);
  const dynamicImport = analyze(
    `async function load() { return import('${ASYNC_STORAGE_PACKAGE}'); }`,
  );

  assert.ok(violationCodes(dynamicReference).includes('dynamic-reference'));
  assert.ok(violationCodes(dynamicImport).includes('dynamic-import'));
});

test('scans transitive mobile production packages and fails incompatible ones', (t) => {
  const repoRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'onekey-async-storage-check-'),
  );
  t.after(() => fs.rmSync(repoRoot, { force: true, recursive: true }));

  const mobileDir = path.join(repoRoot, 'apps', 'mobile');
  const packageRoot = path.join(
    repoRoot,
    'node_modules',
    'bad-storage-package',
  );
  fs.mkdirSync(mobileDir, { recursive: true });
  fs.mkdirSync(packageRoot, { recursive: true });
  fs.writeFileSync(
    path.join(mobileDir, 'package.json'),
    JSON.stringify({ dependencies: { 'bad-storage-package': '1.0.0' } }),
  );
  fs.writeFileSync(
    path.join(packageRoot, 'package.json'),
    JSON.stringify({ name: 'bad-storage-package', version: '1.0.0' }),
  );
  fs.writeFileSync(
    path.join(packageRoot, 'index.js'),
    `const Storage = require('${ASYNC_STORAGE_PACKAGE}/src/NativeAsyncStorage');`,
  );

  const result = scanMobileProductionDependencies({ mobileDir, repoRoot });

  assert.equal(result.dependencyPackageCount, 1);
  assert.equal(result.violations.length, 1);
  assert.equal(result.violations[0].packageName, 'bad-storage-package');
  assert.equal(result.violations[0].code, 'unredirected-package');
});
