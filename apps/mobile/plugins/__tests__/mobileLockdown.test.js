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
  getMobileLockdownE2ERunId,
  getMobileLockdownPolyfills,
  isMobileLockdownEnabled,
} = require('../mobileLockdown');
const {
  createFileToIdMap,
  loadRegistry: loadProductionRegistry,
} = require('../moduleIdRegistry');

const mobileRoot = path.resolve(__dirname, '../..');
const helperPath = path.join(
  mobileRoot,
  'src/security/finishMobileLockdown.ts',
);

test('all guarded Release helpers resolve through the strict production registry', () => {
  const registry = loadProductionRegistry();
  const resolver = createFileToIdMap({ registry, strict: true });
  const helpers = fs
    .readdirSync(path.join(mobileRoot, 'src/security'))
    .filter((name) => /^mobileLockdown.*Release.*\.ts$/u.test(name));
  expect(helpers.length).toBeGreaterThan(0);
  const identifiers = helpers.map((name) =>
    resolver.get(path.join(mobileRoot, 'src/security', name)),
  );
  expect(new Set(identifiers).size).toBe(helpers.length);
  for (const identifier of identifiers) expect(identifier).toBeGreaterThan(0);
});

function createRuntime({
  enabled = true,
  repair = true,
  rawMode = false,
} = {}) {
  // Keep all endowments inside the VM: hardening a host console can freeze
  // the Jest worker's prototypes and break later suites in the same process.
  const context = vm.createContext({});
  vm.runInContext(
    'globalThis.exports = {}; globalThis.process = { env: {} };',
    context,
  );
  if (rawMode && enabled !== undefined) {
    context.process.env.ONEKEY_MOBILE_LOCKDOWN = enabled;
  }
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
      ...(rawMode
        ? []
        : [
            [
              'transform-define',
              { 'process.env.ONEKEY_MOBILE_LOCKDOWN': String(enabled) },
            ],
          ]),
    ],
  });
  vm.runInContext(code, context);
  return context;
}

describe('mobile lockdown bootstrap', () => {
  const originalMode = process.env.ONEKEY_MOBILE_LOCKDOWN;
  const originalE2ERunId = process.env.ONEKEY_MOBILE_LOCKDOWN_E2E;
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
    if (originalE2ERunId === undefined)
      delete process.env.ONEKEY_MOBILE_LOCKDOWN_E2E;
    else process.env.ONEKEY_MOBILE_LOCKDOWN_E2E = originalE2ERunId;
  });

  test('accepts only explicit protected E2E run IDs and separates cache inputs', () => {
    expect(getMobileLockdownE2ERunId({})).toBe('');
    for (const value of [
      '',
      'true',
      'A'.repeat(32),
      'a'.repeat(31),
      'a'.repeat(33),
      ['a'.repeat(32)],
    ]) {
      expect(() =>
        getMobileLockdownE2ERunId({ ONEKEY_MOBILE_LOCKDOWN_E2E: value }),
      ).toThrow('run ID');
    }
    const runId = 'a'.repeat(32);
    expect(() =>
      getMobileLockdownE2ERunId({
        ONEKEY_MOBILE_LOCKDOWN_E2E: runId,
        ONEKEY_MOBILE_LOCKDOWN: 'false',
      }),
    ).toThrow('requires protection');
    delete process.env.ONEKEY_MOBILE_LOCKDOWN;
    delete process.env.ONEKEY_MOBILE_LOCKDOWN_E2E;
    const config = () =>
      applyMobileLockdownConfig({ serializer: { getPolyfills: () => [] } });
    const defaultKey = config().cacheVersion;
    const env = {};
    devVendorConfig.applyTransformationEnvironment(env);
    const defaultEnv = devVendorConfig.getTransformationEnvironment(env);
    process.env.ONEKEY_MOBILE_LOCKDOWN_E2E = runId;
    expect(config().cacheVersion).not.toBe(defaultKey);
    env.ONEKEY_MOBILE_LOCKDOWN_E2E = runId;
    devVendorConfig.applyTransformationEnvironment(env);
    expect(env.ONEKEY_MOBILE_LOCKDOWN_E2E).toBe(runId);
    expect(devVendorConfig.getTransformationEnvironment(env)).not.toEqual(
      defaultEnv,
    );
  });

  test('production E2E requires complete build identity before Metro compilation', () => {
    const env = {
      ONEKEY_MOBILE_LOCKDOWN_E2E: 'a'.repeat(32),
      NODE_ENV: 'production',
      VERSION: '1.0.0',
      BUILD_NUMBER: '1',
      BUNDLE_VERSION: '21600000',
    };
    expect(getMobileLockdownE2ERunId(env)).toBe(env.ONEKEY_MOBILE_LOCKDOWN_E2E);
    for (const key of ['VERSION', 'BUILD_NUMBER', 'BUNDLE_VERSION']) {
      for (const value of [undefined, '', 'invalid', '-1', '0']) {
        expect(() =>
          getMobileLockdownE2ERunId({ ...env, [key]: value }),
        ).toThrow(key);
      }
    }
    expect(getMobileLockdownE2ERunId({ NODE_ENV: 'production' })).toBe('');
  });

  test('Release probe accepts separate hardened heaps and rejects rollback or wrong identity', () => {
    const { code } = babel.transformFileSync(
      path.join(mobileRoot, 'src/security/mobileLockdownReleaseProbe.ts'),
      {
        babelrc: false,
        configFile: false,
        plugins: [
          '@babel/plugin-transform-typescript',
          '@babel/plugin-transform-modules-commonjs',
        ],
      },
    );
    for (const name of ['main', 'background']) {
      const context = createRuntime();
      context.exports.finishMobileLockdown(name);
      vm.runInContext(code, context);
      expect(
        context.exports.captureMobileLockdownIntegrity(name),
      ).toMatchObject({
        runtime: name,
        enabled: true,
        tamperBlocked: true,
        bindingImmutable: true,
      });
      expect(() =>
        context.exports.captureMobileLockdownIntegrity(
          name === 'main' ? 'background' : 'main',
        ),
      ).toThrow('integrity check failed');
    }
    const disabled = createRuntime({ enabled: false, repair: false });
    disabled.exports.finishMobileLockdown('main');
    vm.runInContext(code, disabled);
    expect(() =>
      disabled.exports.captureMobileLockdownIntegrity('main'),
    ).toThrow('integrity check failed');
    for (const prototype of hostPrototypes)
      expect(Object.isFrozen(prototype)).toBe(false);
  });

  test('disabled mode leaves serializers unchanged and invalid modes fail closed', () => {
    process.env.ONEKEY_MOBILE_LOCKDOWN = 'false';
    const serializer = { getPolyfills: jest.fn() };
    const config = applyMobileLockdownConfig({ serializer });
    expect(config.serializer).toBe(serializer);
    expect(config.cacheVersion).toContain('mobile-lockdown-off');
    expect(isMobileLockdownEnabled({ ONEKEY_MOBILE_LOCKDOWN: 'true' })).toBe(
      true,
    );
    expect(isMobileLockdownEnabled({})).toBe(true);
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

  test('an omitted build flag injects the prelude and hardens by default', () => {
    delete process.env.ONEKEY_MOBILE_LOCKDOWN;
    const config = applyMobileLockdownConfig({
      serializer: { getPolyfills: () => [] },
    });
    expect(config.serializer.getPolyfills({ platform: 'ios' })).toEqual(
      getMobileLockdownPolyfills(),
    );
    const context = createRuntime({ rawMode: true });
    delete context.process.env.ONEKEY_MOBILE_LOCKDOWN;
    expect(context.exports.finishMobileLockdown('main').lockdownApplied).toBe(
      true,
    );
    const missingPrelude = createRuntime({ repair: false, rawMode: true });
    delete missingPrelude.process.env.ONEKEY_MOBILE_LOCKDOWN;
    expect(() =>
      missingPrelude.exports.finishMobileLockdown('background'),
    ).toThrow('repair prelude is missing');
  });

  test.each(['', '1', 'TRUE', true])(
    'runtime rejects invalid mode %p before reporting success',
    (enabled) => {
      const context = createRuntime({ enabled, repair: false, rawMode: true });
      expect(() => context.exports.finishMobileLockdown('main')).toThrow(
        'must be true or false',
      );
      expect(context.__ONEKEY_MOBILE_LOCKDOWN_STATE__).toBeUndefined();
    },
  );

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
    const defaultEnv = {};
    const disabledEnv = { ONEKEY_MOBILE_LOCKDOWN: 'false' };
    devVendorConfig.applyTransformationEnvironment(enabledEnv);
    devVendorConfig.applyTransformationEnvironment(defaultEnv);
    devVendorConfig.applyTransformationEnvironment(disabledEnv);
    expect(enabledEnv.ONEKEY_MOBILE_LOCKDOWN).toBe('true');
    expect(disabledEnv.ONEKEY_MOBILE_LOCKDOWN).toBe('false');
    expect(defaultEnv.ONEKEY_MOBILE_LOCKDOWN).toBe('true');
    expect(devVendorConfig.getTransformationEnvironment(defaultEnv)).toEqual(
      devVendorConfig.getTransformationEnvironment(enabledEnv),
    );
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

  test('rejects a rollback vendor before evaluating a default-enabled delta', () => {
    const {
      computeConfigInputsDigest,
      verifyManifest,
    } = require('../devVendor');
    const { loadRegistry } = require('../moduleIdRegistry');
    const repoRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'onekey-lockdown-cache-'),
    );
    try {
      for (const filename of devVendorConfig.fingerprintFiles) {
        const destination = path.join(repoRoot, filename);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.copyFileSync(
          path.resolve(mobileRoot, '../..', filename),
          destination,
        );
      }
      for (const directory of devVendorConfig.fingerprintDirectories) {
        fs.mkdirSync(path.join(repoRoot, directory), { recursive: true });
      }
      const defaultEnv = {};
      devVendorConfig.applyTransformationEnvironment(defaultEnv);
      process.env.ONEKEY_MOBILE_LOCKDOWN = defaultEnv.ONEKEY_MOBILE_LOCKDOWN;
      const rollbackDigest = computeConfigInputsDigest(repoRoot, {
        ...process.env,
        ONEKEY_MOBILE_LOCKDOWN: 'false',
      });
      expect(rollbackDigest).not.toBe(computeConfigInputsDigest(repoRoot));
      expect(() =>
        verifyManifest({
          repoRoot,
          projectRoot: path.join(repoRoot, 'apps/mobile'),
          platform: 'ios',
          manifest: {
            schemaVersion: devVendorConfig.SCHEMA_VERSION,
            strategyVersion: devVendorConfig.STRATEGY_VERSION,
            platform: 'ios',
            registryEpoch: loadRegistry().registryEpoch,
            modules: [],
            prependModules: [],
            configInputsDigest: rollbackDigest,
          },
        }),
      ).toThrow('Build configuration changed');
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test.each(['index.ts', 'background.ts'])(
    '%s finalizes after synchronous polyfills before marking runtime ready',
    (entry) => {
      const source = fs.readFileSync(path.join(mobileRoot, entry), 'utf8');
      const polyfills = source.indexOf(
        "require('@onekeyhq/shared/src/polyfills')",
      );
      const finish = source.indexOf('finishMobileLockdown(', polyfills);
      const tracker = source.indexOf('prepareNativePromiseRejectionTracker();');
      const ready = source.indexOf('markRuntimePolyfillsReady()');
      expect(polyfills).toBeGreaterThan(0);
      expect(tracker).toBeGreaterThan(polyfills);
      expect(finish).toBeGreaterThan(tracker);
      expect(ready).toBeGreaterThan(finish);
    },
  );
});
