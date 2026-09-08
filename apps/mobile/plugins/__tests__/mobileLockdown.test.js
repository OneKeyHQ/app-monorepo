/* eslint-env jest */
const fs = require('fs');
const { createRequire } = require('module');
const os = require('os');
const path = require('path');
const vm = require('vm');

const babel = require('@babel/core');

const devVendorConfig = require('../../dev-vendor.config');
const {
  applyMobileLockdownConfig,
  getMobileLockdownPolyfills,
  isMobileLockdownEnabled,
} = require('../mobileLockdown');

const mobileRoot = path.resolve(__dirname, '../..');
const helperPath = path.join(
  mobileRoot,
  'src/security/finishMobileLockdown.ts',
);

function createRuntime({ enabled = true, repair = true } = {}) {
  // Keep all endowments inside the VM: hardening a host console can freeze
  // the Jest worker's prototypes and break later suites in the same process.
  const context = vm.createContext({});
  vm.runInContext('globalThis.exports = {};', context);
  if (repair) {
    const adapterRequire = createRequire(
      require.resolve('@lavamoat/react-native-lockdown/package.json'),
    );
    [
      adapterRequire.resolve('ses/hermes'),
      adapterRequire.resolve('@lavamoat/react-native-lockdown/repair'),
    ].forEach((filename) => {
      vm.runInContext(fs.readFileSync(filename, 'utf8'), context);
    });
  }
  const { code } = babel.transformFileSync(helperPath, {
    babelrc: false,
    configFile: false,
    plugins: [
      '@babel/plugin-transform-typescript',
      '@babel/plugin-transform-modules-commonjs',
      [
        'transform-define',
        { 'process.env.ONEKEY_MOBILE_LOCKDOWN': String(enabled) },
      ],
    ],
  });
  vm.runInContext(code, context);
  return context;
}

describe('mobile lockdown bootstrap', () => {
  const originalMode = process.env.ONEKEY_MOBILE_LOCKDOWN;
  // Jest's console functions may originate in the worker realm rather than
  // this suite's realm. Check both sets of prototypes for cross-realm damage.
  const consoleFunctionPrototype = Object.getPrototypeOf(console.log);
  const hostPrototypes = [
    Object.prototype,
    Array.prototype,
    Function.prototype,
    consoleFunctionPrototype,
    Object.getPrototypeOf(consoleFunctionPrototype),
  ];
  afterEach(() => {
    if (originalMode === undefined) delete process.env.ONEKEY_MOBILE_LOCKDOWN;
    else process.env.ONEKEY_MOBILE_LOCKDOWN = originalMode;
  });

  test('disabled mode leaves serializers unchanged and invalid modes fail closed', () => {
    delete process.env.ONEKEY_MOBILE_LOCKDOWN;
    const serializer = { getPolyfills: jest.fn() };
    const config = applyMobileLockdownConfig({ serializer });
    expect(config.serializer).toBe(serializer);
    expect(config.cacheVersion).toContain('mobile-lockdown-off');
    expect(isMobileLockdownEnabled({ ONEKEY_MOBILE_LOCKDOWN: 'true' })).toBe(
      true,
    );
    expect(() =>
      isMobileLockdownEnabled({ ONEKEY_MOBILE_LOCKDOWN: '1' }),
    ).toThrow('must be true or false');
  });

  test('only enabled, exact vetted sources bypass application Babel transforms', async () => {
    const upstream = require('@expo/metro-config/babel-transformer');
    const transform = jest
      .spyOn(upstream, 'transform')
      .mockReturnValue({ ast: 'application-transform' });
    const transformer = require('../../svgx-transformer');
    const temporaryDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'onekey-lockdown-transform-'),
    );
    const imitation = path.join(temporaryDirectory, 'repair.js');
    fs.writeFileSync(imitation, 'var ordinaryDependency = true;');
    const [, repair] = getMobileLockdownPolyfills();
    const args = (filename) => ({
      filename: path.relative(mobileRoot, filename),
      src: fs.readFileSync(filename, 'utf8'),
      options: { projectRoot: mobileRoot },
    });
    try {
      process.env.ONEKEY_MOBILE_LOCKDOWN = 'true';
      expect((await transformer.transform(args(repair))).ast.type).toBe('File');
      expect(transform).not.toHaveBeenCalled();
      expect((await transformer.transform(args(imitation))).ast).toBe(
        'application-transform',
      );
      process.env.ONEKEY_MOBILE_LOCKDOWN = 'false';
      expect((await transformer.transform(args(repair))).ast).toBe(
        'application-transform',
      );
      expect(transform).toHaveBeenCalledTimes(2);
    } finally {
      transform.mockRestore();
      fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });

  test('preserves union, segments, vendor and arbitrary module ID hooks', () => {
    process.env.ONEKEY_MOBILE_LOCKDOWN = 'true';
    const serializer = {
      customSerializer: jest.fn(),
      getRunModuleStatement: jest.fn((id) => `customRequire(${id});`),
      getModulesRunBeforeMainModule: jest.fn(() => ['/rn/InitializeCore.js']),
      getPolyfills: jest.fn(() => ['/rn/polyfills.js']),
      processModuleFilter: jest.fn(() => true),
    };
    const config = applyMobileLockdownConfig({ serializer });
    expect(config.serializer.customSerializer).toBe(
      serializer.customSerializer,
    );
    expect(config.serializer.getModulesRunBeforeMainModule).toBe(
      serializer.getModulesRunBeforeMainModule,
    );
    expect(config.serializer.getRunModuleStatement(1234)).toBe(
      'customRequire(1234);',
    );
    const polyfills = config.serializer.getPolyfills({ platform: 'ios' });
    expect(polyfills[0]).toMatch(/ses-hermes\.cjs$/);
    expect(polyfills[1]).toMatch(
      /react-native-lockdown[\\/]src[\\/]repair\.js$/,
    );
    expect(polyfills[2]).toBe('/rn/polyfills.js');
    expect(config.serializer.processModuleFilter({ path: polyfills[0] })).toBe(
      true,
    );
    expect(
      config.serializer.processModuleFilter({ path: '/app/index.ts' }),
    ).toBe(true);
    expect(() =>
      config.serializer.processModuleFilter({
        path: '/app/node_modules/ses/dist/ses.cjs',
      }),
    ).toThrow('second or vanilla SES');
    expect(() =>
      config.serializer.processModuleFilter({
        path: '/app/node_modules/dependency/node_modules/ses/dist/ses-hermes.cjs',
      }),
    ).toThrow('second or vanilla SES');
    expect(serializer.processModuleFilter).toHaveBeenCalledWith({
      path: '/app/index.ts',
    });
  });

  test('development vendor serialization retains the configured SES guard', () => {
    const { createBundleOptions } = require('../../scripts/build-dev-vendor');
    process.env.ONEKEY_MOBILE_LOCKDOWN = 'true';
    const config = applyMobileLockdownConfig({
      projectRoot: mobileRoot,
      server: {},
      transformer: { asyncRequireModulePath: '/fixture/asyncRequire.js' },
      serializer: {
        getPolyfills: () => [],
        processModuleFilter: ({ path: filename }) =>
          filename !== '/fixture/excluded.js',
      },
    });
    const selection = jest.fn(() => true);
    const options = createBundleOptions({
      config,
      createModuleId: () => 1,
      moduleFilter: selection,
      runBeforeMainModule: [],
    });
    config.serializer.getPolyfills({ platform: 'ios' }).forEach((filename) => {
      expect(options.processModuleFilter({ path: filename })).toBe(true);
    });
    expect(options.processModuleFilter({ path: '/fixture/excluded.js' })).toBe(
      false,
    );
    expect(selection).not.toHaveBeenCalledWith('/fixture/excluded.js');
    expect(() =>
      options.processModuleFilter({
        path: '/fixture/node_modules/dependency/node_modules/ses/dist/ses.cjs',
      }),
    ).toThrow('second or vanilla SES');
  });

  test.each(['main', 'background'])(
    '%s hardens after vetted shims and only once',
    (runtime) => {
      const context = createRuntime();
      vm.runInContext(
        'Object.prototype.onekeyVettedShim = function () { return 42; };',
        context,
      );
      const state = context.exports.finishMobileLockdown(runtime);
      expect(state).toEqual({
        enabled: true,
        runtime,
        lockdownApplied: true,
        evalTaming: 'unsafe-eval',
      });
      expect(
        vm.runInContext(
          'Object.isFrozen(Object.prototype) && ({}).onekeyVettedShim() === 42',
          context,
        ),
      ).toBe(true);
      expect(() =>
        vm.runInContext(
          '"use strict"; Array.prototype.push = function () {};',
          context,
        ),
      ).toThrow();
      expect(context.exports.finishMobileLockdown(runtime)).toBe(state);
      expect(() =>
        context.exports.finishMobileLockdown(
          runtime === 'main' ? 'background' : 'main',
        ),
      ).toThrow('without a restart');
    },
  );

  test('main and background are separate JS heaps and leave host intrinsics mutable', () => {
    expect(hostPrototypes.map(Object.isFrozen)).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
    const main = createRuntime();
    const background = createRuntime();
    main.exports.finishMobileLockdown('main');
    expect(
      vm.runInContext('Object.isFrozen(Object.prototype)', background),
    ).toBe(false);
    expect(background.__ONEKEY_MOBILE_LOCKDOWN_STATE__).toBeUndefined();
    background.exports.finishMobileLockdown('background');
    expect(background.__ONEKEY_MOBILE_LOCKDOWN_STATE__.runtime).toBe(
      'background',
    );
    expect(hostPrototypes.map(Object.isFrozen)).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  test('enabled mode fails if serializer omitted SES instead of falling back to disabled', () => {
    const context = createRuntime({ repair: false });
    expect(() => context.exports.finishMobileLockdown('main')).toThrow(
      'repair prelude is missing',
    );
    expect(context.__ONEKEY_MOBILE_LOCKDOWN_STATE__).toBeUndefined();
  });

  test('a hardening function that fails to freeze intrinsics cannot report success', () => {
    const context = createRuntime({ repair: false });
    vm.runInContext(
      'globalThis.hardenIntrinsics = function () {}; globalThis.harden = function (value) { return value; };',
      context,
    );
    expect(() => context.exports.finishMobileLockdown('main')).toThrow(
      'did not harden',
    );
    expect(context.__ONEKEY_MOBILE_LOCKDOWN_STATE__).toBeUndefined();
  });

  test('the native shared loader refuses to initialize another SES instance', () => {
    const filename = path.resolve(
      mobileRoot,
      '../../packages/shared/src/security/sesHarden/loadSes.native.ts',
    );
    const { code } = babel.transformFileSync(filename, {
      babelrc: false,
      configFile: false,
      plugins: [
        '@babel/plugin-transform-typescript',
        '@babel/plugin-transform-modules-commonjs',
      ],
    });
    const dependencies = [];
    const context = vm.createContext({
      exports: {},
      require(request) {
        dependencies.push(request);
        if (request === '../../errors') return { OneKeyLocalError: Error };
        throw new Error(`Unexpected native SES dependency: ${request}`);
      },
    });
    vm.runInContext(code, context);
    expect(() => context.exports.default()).toThrow(
      'must be enabled at build time',
    );
    expect(dependencies).toEqual(['../../errors']);
  });

  test('disabled builds load without SES and keep intrinsics mutable', () => {
    const context = createRuntime({ enabled: false, repair: false });
    expect(context.exports.finishMobileLockdown('main').lockdownApplied).toBe(
      false,
    );
    expect(vm.runInContext('Object.isFrozen(Object.prototype)', context)).toBe(
      false,
    );
  });

  test('vendor environment preserves and fingerprints the selected mode', () => {
    const enabledEnv = { ONEKEY_MOBILE_LOCKDOWN: 'true' };
    const disabledEnv = {};
    devVendorConfig.applyTransformationEnvironment(enabledEnv);
    devVendorConfig.applyTransformationEnvironment(disabledEnv);
    expect(enabledEnv.ONEKEY_MOBILE_LOCKDOWN).toBe('true');
    expect(disabledEnv.ONEKEY_MOBILE_LOCKDOWN).toBe('false');
    expect(
      devVendorConfig.getTransformationEnvironment(enabledEnv),
    ).not.toEqual(devVendorConfig.getTransformationEnvironment(disabledEnv));
    expect(devVendorConfig.fingerprintFiles).toContain(
      'apps/mobile/plugins/mobileLockdown.js',
    );
    expect(devVendorConfig.fingerprintFiles).toContain(
      'apps/mobile/src/security/finishMobileLockdown.ts',
    );
  });

  test.each(['index.ts', 'background.ts'])(
    '%s finalizes after synchronous polyfills before marking runtime ready',
    (entry) => {
      const source = fs.readFileSync(path.join(mobileRoot, entry), 'utf8');
      const polyfills = source.indexOf(
        "require('@onekeyhq/shared/src/polyfills')",
      );
      const finish = source.indexOf('finishMobileLockdown(', polyfills);
      const ready = source.indexOf('markRuntimePolyfillsReady()');
      expect(polyfills).toBeGreaterThan(0);
      expect(finish).toBeGreaterThan(polyfills);
      expect(ready).toBeGreaterThan(finish);
    },
  );
});
