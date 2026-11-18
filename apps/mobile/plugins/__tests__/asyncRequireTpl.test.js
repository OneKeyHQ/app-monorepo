const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { getMobileLockdownPolyfills } = require('../mobileLockdown');

function createProtectedRuntime() {
  const context = vm.createContext({});
  vm.runInContext(
    'globalThis.global = globalThis; globalThis.console = {log(){},warn(){},error(){}};',
    context,
  );
  for (const filename of getMobileLockdownPolyfills())
    vm.runInContext(fs.readFileSync(filename, 'utf8'), context);
  vm.runInContext('hardenIntrinsics();', context);
  return context;
}

test.each(['main', 'background'])(
  '%s cannot execute the legacy HTTP chunk loader under no-eval',
  async () => {
    const context = createProtectedRuntime();
    const coreModule = { exports: {} };
    context.module = coreModule;
    vm.runInContext(
      `(function() { ${fs.readFileSync(path.join(__dirname, '../asyncRequireCore.js'), 'utf8')} })()`,
      context,
    );
    context.fetch = async () => ({
      status: 200,
      text: async () => 'globalThis.publicLazyFixture = 42;',
    });
    context.require = (specifier) => {
      if (specifier === '__ASYNC_REQUIRE_CORE__') return coreModule.exports;
      if (specifier === '__CHUNK_MODULE_ID_TO_HASH_MAP__')
        return { 42: 'public-fixture' };
      if (specifier === 'metro-runtime/src/modules/asyncRequire')
        return async () => context.publicLazyFixture;
      if (specifier === 'react-native') return { NativeModules: {} };
      throw new Error(`Unexpected fixture import: ${specifier}`);
    };
    context.module = { exports: {} };
    vm.runInContext(
      fs.readFileSync(path.join(__dirname, '../asyncRequireTpl.js'), 'utf8'),
      context,
    );
    await expect(context.module.exports(42, [])).rejects.toThrow('SES_NO_EVAL');
    expect(() => vm.runInContext('Function("return 3")()', context)).toThrow(
      'SES_NO_EVAL',
    );
  },
);

test.each(['main', 'background'])(
  '%s imports a bundled module through real Metro after a microtask under no-eval',
  async () => {
    const context = createProtectedRuntime();
    const imports = [];
    context.__METRO_GLOBAL_PREFIX__ = '';
    context.__loadBundleAsync = () => {
      throw new Error('A complete development graph must not fetch code');
    };
    context.require = Object.assign(
      (name) => {
        if (name === 'metro-runtime/src/modules/asyncRequire')
          return metroAsyncRequire;
        throw new Error(`Unexpected import: ${name}`);
      },
      {
        importAll: (id) => {
          imports.push(id);
          return id;
        },
      },
    );
    context.module = { exports: {} };
    vm.runInContext(
      `(function() { ${fs.readFileSync(require.resolve('metro-runtime/src/modules/asyncRequire'), 'utf8')} })()`,
      context,
    );
    const metroAsyncRequire = context.module.exports;
    context.module = { exports: {} };
    vm.runInContext(
      fs.readFileSync(path.join(__dirname, '../asyncRequireEager.js'), 'utf8'),
      context,
    );
    const pending = context.module.exports(42);
    expect(imports).toEqual([]);
    await expect(pending).resolves.toBe(42);
    expect(imports).toEqual([42]);
    expect(context.module.exports.prefetch).toBe(metroAsyncRequire.prefetch);
    context.module.exports.prefetch(42);
    expect(context.module.exports.unstable_importMaybeSync(42)).toBe(42);
    expect(imports).toEqual([42, 42]);
    for (const source of ['eval("1+2")', 'Function("return 3")()'])
      expect(() => vm.runInContext(source, context)).toThrow('SES_NO_EVAL');
  },
);
