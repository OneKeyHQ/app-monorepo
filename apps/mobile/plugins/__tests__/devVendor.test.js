/* cspell:words autolinking codegen */

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');

const babel = require('@babel/core');
const xcode = require('xcode');

jest.mock('@rozenite/metro', () => ({
  withRozenite: (config) => config,
}));
jest.mock('@storybook/react-native/metro/withStorybook', () => ({
  withStorybook: (config) => config,
}));

const repoRoot = path.resolve(__dirname, '../../../..');
const metroRoot = path.join(repoRoot, 'node_modules/metro/src');
const parseBundleOptions = require(
  path.join(metroRoot, 'lib/parseBundleOptionsFromBundleRequestUrl'),
).default;
const splitBundleOptions = require(
  path.join(metroRoot, 'lib/splitBundleOptions'),
).default;
const hmrJSBundle = require(
  path.join(metroRoot, 'DeltaBundler/Serializers/hmrJSBundle'),
).default;
const { shouldRetainModulesOnlyGraphForHmr } = require(
  path.join(metroRoot, 'Server'),
);

const devVendorConfig = require('../../dev-vendor.config');
const {
  assertNativeDevVendorResolverContract,
  assertNativeDevVendorServerEnabled,
  assertSortedUniqueModules,
  computeConfigInputsDigest,
  computeFingerprint,
  computeModulesDigest,
  computeNativeContractKey,
  computeShellInputKey,
  computeRegistryInputsDigest,
  computeReleaseCompatibilityKey,
  composeDevVendorBundle,
  getDevVendorStubModuleId,
  getNativeContractInputPaths,
  getNativeContractDescriptor,
  getPlatformOutputDirectory,
  getShellInputPaths,
  hashRepoFiles,
  hashShellInputFiles,
  isDevVendorEnabled,
  isDevVendorRequest,
  inspectDevVendorGraph,
  loadRuntime,
  refreshRuntimeCacheForChanges,
  resetRuntimeCacheForTests,
  sha256,
  shouldPrependCommon,
  verifyManifest,
} = require('../devVendor');
const { loadRegistry } = require('../moduleIdRegistry');

function loadGetDevServer(scriptURL, runtimeGlobal = {}) {
  const filename = path.join(
    repoRoot,
    'node_modules/react-native/Libraries/Core/Devtools/getDevServer.js',
  );
  const source = fs.readFileSync(filename, 'utf8');
  const { code } = babel.transformSync(source, {
    babelrc: false,
    configFile: false,
    plugins: [
      '@babel/plugin-transform-flow-strip-types',
      '@babel/plugin-transform-modules-commonjs',
    ],
  });
  const module = { exports: {} };
  vm.runInNewContext(code, {
    exports: module.exports,
    global: runtimeGlobal,
    module,
    require: (request) => {
      if (request === '../../NativeModules/specs/NativeSourceCode') {
        return {
          __esModule: true,
          default: { getConstants: () => ({ scriptURL }) },
        };
      }
      throw new Error(`Unexpected getDevServer dependency: ${request}`);
    },
  });
  return { getDevServer: module.exports.default, runtimeGlobal };
}

function loadResolveAssetSource(scriptURL) {
  const filename = path.join(
    repoRoot,
    'node_modules/react-native/Libraries/Image/resolveAssetSource.js',
  );
  const source = fs.readFileSync(filename, 'utf8');
  const { code } = babel.transformSync(source, {
    babelrc: false,
    configFile: false,
    plugins: [
      '@babel/plugin-transform-flow-strip-types',
      '@babel/plugin-transform-modules-commonjs',
    ],
  });
  const runtimeGlobal = {};
  const { getDevServer } = loadGetDevServer(scriptURL, runtimeGlobal);
  const module = { exports: {} };
  class TestAssetSourceResolver {
    constructor(serverURL, scriptBundleURL) {
      this.serverURL = serverURL;
      this.scriptBundleURL = scriptBundleURL;
    }

    defaultAsset() {
      return {
        scriptBundleURL: this.scriptBundleURL,
        serverURL: this.serverURL,
      };
    }
  }
  vm.runInNewContext(code, {
    exports: module.exports,
    global: runtimeGlobal,
    module,
    require: (request) => {
      if (request === './AssetSourceResolver') {
        return { default: TestAssetSourceResolver };
      }
      if (request === './AssetUtils') {
        return { pickScale: () => 1 };
      }
      if (request === '@react-native/assets-registry/registry') {
        return { getAssetByID: () => ({ name: 'test', type: 'png' }) };
      }
      if (request === '../Core/Devtools/getDevServer') {
        return { __esModule: true, default: getDevServer };
      }
      if (request === '../NativeModules/specs/NativeSourceCode') {
        return {
          __esModule: true,
          default: { getConstants: () => ({ scriptURL }) },
        };
      }
      throw new Error(`Unexpected resolveAssetSource dependency: ${request}`);
    },
  });
  return { resolveAssetSource: module.exports.default, runtimeGlobal };
}

function loadIOSMainBundlePhase() {
  const project = xcode.project(
    path.join(
      repoRoot,
      'apps/mobile/ios/OneKeyWallet.xcodeproj/project.pbxproj',
    ),
  );
  project.parseSync();
  const phase = Object.values(
    project.hash.project.objects.PBXShellScriptBuildPhase,
  ).find(
    (candidate) =>
      candidate &&
      typeof candidate === 'object' &&
      typeof candidate.name === 'string' &&
      JSON.parse(candidate.name) === 'Bundle React Native code and images',
  );
  if (!phase) {
    throw new Error('Unable to find the iOS main bundle build phase');
  }
  return {
    script: JSON.parse(phase.shellScript),
    shellPath: phase.shellPath,
  };
}

function createMetroModule(modulePath) {
  return {
    dependencies: new Map(),
    inverseDependencies: new Set(),
    output: [
      {
        data: { code: '__d(function() {});', lineCount: 1 },
        type: 'js/module',
      },
    ],
    path: modulePath,
  };
}

function createTemporaryRuntimeFixture() {
  const temporaryRepoRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'onekey-dev-vendor-runtime-'),
  );
  const fixtureFiles = new Set([
    ...devVendorConfig.fingerprintFiles,
    ...['android', 'ios'].flatMap((platform) =>
      getNativeContractInputPaths(platform, repoRoot),
    ),
    ...['android', 'ios'].flatMap((platform) =>
      getShellInputPaths(platform, repoRoot),
    ),
    ...devVendorConfig.releaseFingerprintFiles,
  ]);
  for (const relativePath of fixtureFiles) {
    const destination = path.join(temporaryRepoRoot, relativePath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(repoRoot, relativePath), destination);
  }
  for (const relativeDirectory of devVendorConfig.fingerprintDirectories) {
    fs.mkdirSync(path.join(temporaryRepoRoot, relativeDirectory), {
      recursive: true,
    });
  }
  for (const relativePath of [
    '.gitignore',
    'apps/mobile/.gitignore',
    'apps/mobile/android/.gitignore',
    'apps/mobile/ios/.gitignore',
  ]) {
    const destination = path.join(temporaryRepoRoot, relativePath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(repoRoot, relativePath), destination);
  }
  const nativeDependencies = new Set([
    ...devVendorConfig.nativeContractDependencies.shared,
    ...devVendorConfig.nativeContractDependencies.android,
    ...devVendorConfig.nativeContractDependencies.ios,
  ]);
  for (const name of nativeDependencies) {
    const source = require.resolve(`${name}/package.json`, {
      paths: [path.join(repoRoot, 'apps/mobile')],
    });
    const destination = path.join(
      temporaryRepoRoot,
      'node_modules',
      ...name.split('/'),
      'package.json',
    );
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  }
  const modulePath = 'apps/mobile/index.ts';
  const moduleSourcePath = path.join(temporaryRepoRoot, modulePath);
  fs.mkdirSync(path.dirname(moduleSourcePath), { recursive: true });
  fs.writeFileSync(moduleSourcePath, 'module.exports = "common input";\n');
  for (const args of [
    ['init', '--quiet'],
    ['add', '--all'],
  ]) {
    const result = spawnSync('git', args, {
      cwd: temporaryRepoRoot,
      encoding: 'utf8',
    });
    if (result.status !== 0 || result.error) {
      throw new Error(
        `Unable to initialize fixture repository: ${result.stderr || result.error?.message || 'unknown error'}`,
      );
    }
  }
  const projectRoot = path.join(temporaryRepoRoot, 'apps/mobile');
  const moduleId = loadRegistry().modules[modulePath];
  const modules = [{ id: moduleId, path: modulePath }];

  const writeArtifacts = (sourceCode) => {
    const artifactDirectory = getPlatformOutputDirectory(projectRoot, 'ios');
    fs.mkdirSync(path.join(artifactDirectory, 'stubs'), { recursive: true });
    const source = Buffer.from(sourceCode);
    const bytecode = Buffer.from(`hbc:${sourceCode}`);
    fs.writeFileSync(path.join(artifactDirectory, 'common.js'), source);
    fs.writeFileSync(path.join(artifactDirectory, 'common.hbc'), bytecode);
    fs.writeFileSync(
      path.join(artifactDirectory, 'stubs', `${moduleId}.js`),
      '',
    );
    const fingerprintFields = {
      schemaVersion: devVendorConfig.SCHEMA_VERSION,
      strategyVersion: devVendorConfig.STRATEGY_VERSION,
      platform: 'ios',
      registryEpoch: loadRegistry().registryEpoch,
      configInputsDigest: computeConfigInputsDigest(temporaryRepoRoot),
      modulesDigest: computeModulesDigest(modules, temporaryRepoRoot),
      nativeContractKey: computeNativeContractKey('ios', temporaryRepoRoot),
      modules,
      prependModules: [],
    };
    const manifest = {
      ...fingerprintFields,
      fingerprint: computeFingerprint(fingerprintFields),
      common: {
        source: {
          file: 'common.js',
          bytes: source.length,
          sha256: sha256(source),
        },
        bytecode: {
          file: 'common.hbc',
          bytes: bytecode.length,
          sha256: sha256(bytecode),
        },
      },
    };
    fs.writeFileSync(
      path.join(artifactDirectory, 'manifest.json'),
      `${JSON.stringify(manifest)}\n`,
    );
  };

  writeArtifacts('first common source');
  return {
    moduleSourcePath,
    projectRoot,
    repoRoot: temporaryRepoRoot,
    writeArtifacts,
  };
}

function getAutolinkedNativeDependencies(platform) {
  const cwd = path.join(repoRoot, 'apps/mobile');
  const run = (args) => {
    const result = spawnSync(
      'yarn',
      ['exec', 'expo-modules-autolinking', ...args, '--json'],
      { cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
    );
    if (result.status !== 0 || result.error) {
      throw new Error(
        `Autolinking failed: ${result.stderr || result.error?.message || 'unknown error'}`,
      );
    }
    return JSON.parse(result.stdout);
  };
  const expoModules = run(['resolve', '--platform', platform]).modules.map(
    ({ packageName }) => packageName,
  );
  const reactNativeConfig = run([
    'react-native-config',
    '--platform',
    platform,
  ]);
  const reactNativeModules = Object.entries(reactNativeConfig.dependencies)
    .filter(([, dependency]) => dependency.platforms[platform])
    .map(([name]) => name);
  return [
    ...new Set([
      ...expoModules,
      ...reactNativeModules,
      'hermes-compiler',
      'react-native',
    ]),
  ].toSorted();
}

describe('devVendor', () => {
  afterEach(() => {
    resetRuntimeCacheForTests();
  });

  it('only enables the experiment for an explicit true value', () => {
    expect(isDevVendorEnabled({ ONEKEY_DEV_VENDOR: 'true' })).toBe(true);
    expect(isDevVendorEnabled({ ONEKEY_DEV_VENDOR: 'false' })).toBe(false);
    expect(isDevVendorEnabled({})).toBe(false);
  });

  it('keeps native manifest checks bound to the embedded shell contract', () => {
    const iosSource = fs.readFileSync(
      path.join(repoRoot, 'apps/mobile/ios/AppDelegate.swift'),
      'utf8',
    );
    const androidSource = fs.readFileSync(
      path.join(
        repoRoot,
        'apps/mobile/android/app/src/debug/java/so/onekey/app/wallet/MainApplication.java',
      ),
      'utf8',
    );

    expect(iosSource).toContain(
      'manifest["nativeContractKey"] as? String == nativeContractKey',
    );
    expect(iosSource).toContain(
      'forInfoDictionaryKey: "ONEKEY_DEV_VENDOR_SCHEMA_VERSION"',
    );
    expect(iosSource).toContain(
      'forInfoDictionaryKey: "ONEKEY_DEV_VENDOR_STRATEGY_VERSION"',
    );
    expect(iosSource).toContain(
      'contractVendorSchema.intValue == vendorSchemaVersion',
    );
    expect(iosSource).toContain(
      'contractVendorStrategy.intValue == vendorStrategyVersion',
    );
    expect(androidSource).toContain(
      'contract.optInt("vendorSchemaVersion", -2)',
    );
    expect(androidSource).toContain(
      'contract.optInt("vendorStrategyVersion", -2)',
    );
    expect(androidSource).toContain('manifest.optString("nativeContractKey")');
  });

  it('maps generated stubs back to their stable module ID', () => {
    const projectRoot = path.resolve('/tmp/onekey/apps/mobile');
    const stubPath = path.join(
      projectRoot,
      'out-dir-bundle/dev-vendor/ios/stubs/4319.js',
    );

    expect(getDevVendorStubModuleId(stubPath, projectRoot)).toBe(4319);
    expect(
      getDevVendorStubModuleId(
        path.join(projectRoot, 'out-dir-bundle/dev-vendor/ios/common.js'),
        projectRoot,
      ),
    ).toBeUndefined();
    expect(
      getDevVendorStubModuleId('/tmp/outside/4319.js', projectRoot),
    ).toBeUndefined();
  });

  it('filters common stubs from HMR added and modified modules', () => {
    const projectRoot = path.resolve('/tmp/onekey/apps/mobile');
    const stubPath = path.join(
      projectRoot,
      'out-dir-bundle/dev-vendor/ios/stubs/4319.js',
    );
    const appPath = path.join(projectRoot, 'App.tsx');
    const stubModule = createMetroModule(stubPath);
    const appModule = createMetroModule(appPath);
    const graph = {
      dependencies: new Map([
        [stubPath, stubModule],
        [appPath, appModule],
      ]),
    };
    const update = hmrJSBundle(
      {
        added: new Map([
          [stubPath, stubModule],
          [appPath, appModule],
        ]),
        deleted: new Set(),
        modified: new Map([[stubPath, stubModule]]),
      },
      graph,
      {
        clientUrl: new URL('http://localhost:8081/index.bundle?dev=true'),
        createModuleId: (modulePath) =>
          getDevVendorStubModuleId(modulePath, projectRoot) ?? 90_001,
        includeAsyncPaths: false,
        processModuleFilter: (moduleData) =>
          getDevVendorStubModuleId(moduleData.path, projectRoot) === undefined,
        projectRoot,
        serverRoot: projectRoot,
      },
    );

    expect(update.added.map(({ module }) => module[0])).toEqual([90_001]);
    expect(update.modified).toEqual([]);
  });

  it('reloads runtime artifacts when a cached manifest directory changes', () => {
    const fixture = createTemporaryRuntimeFixture();
    try {
      const first = loadRuntime(fixture.projectRoot, 'ios', {
        repoRoot: fixture.repoRoot,
      });
      fixture.writeArtifacts('second common source with different bytes');
      const second = loadRuntime(fixture.projectRoot, 'ios', {
        repoRoot: fixture.repoRoot,
        validateArtifacts: true,
      });

      expect(first.sourceCode).toBe('first common source');
      expect(second.sourceCode).toBe(
        'second common source with different bytes',
      );
      expect(second).not.toBe(first);
    } finally {
      fs.rmSync(fixture.repoRoot, { force: true, recursive: true });
    }
  });

  it('rejects cached runtime state after a common source file changes', () => {
    const fixture = createTemporaryRuntimeFixture();
    try {
      loadRuntime(fixture.projectRoot, 'ios', {
        repoRoot: fixture.repoRoot,
      });
      fs.writeFileSync(
        fixture.moduleSourcePath,
        'module.exports = "changed common input";\n',
      );

      expect(() =>
        refreshRuntimeCacheForChanges({
          changedFiles: new Set([fixture.moduleSourcePath]),
          platform: 'ios',
          projectRoot: fixture.projectRoot,
          repoRoot: fixture.repoRoot,
        }),
      ).toThrow('Common module sources changed for ios');
    } finally {
      fs.rmSync(fixture.repoRoot, { force: true, recursive: true });
    }
  });

  it('creates a deterministic fingerprint from ordered manifest fields', () => {
    const fields = {
      schemaVersion: 1,
      strategyVersion: 1,
      platform: 'ios',
      registryEpoch: loadRegistry().registryEpoch,
      configInputsDigest: 'config',
      modulesDigest: 'modules',
      modules: [
        { id: 1, path: 'node_modules/a.js', ignored: 'value' },
        { id: 2, path: 'node_modules/b.js' },
      ],
      prependModules: [{ id: 3, path: 'node_modules/prelude.js' }],
    };

    expect(computeFingerprint(fields)).toBe(computeFingerprint(fields));
    expect(
      computeFingerprint({ ...fields, modulesDigest: 'changed' }),
    ).not.toBe(computeFingerprint(fields));
    expect(computeFingerprint({ ...fields, prependModules: [] })).not.toBe(
      computeFingerprint(fields),
    );
  });

  it('invalidates config digests for transitive transformer and environment changes', () => {
    const fixture = createTemporaryRuntimeFixture();
    const developmentEnv = { ...process.env, NODE_ENV: 'development' };
    try {
      const baseline = computeConfigInputsDigest(
        fixture.repoRoot,
        developmentEnv,
      );
      expect(
        computeConfigInputsDigest(fixture.repoRoot, {
          ...developmentEnv,
          NODE_ENV: 'production',
        }),
      ).not.toBe(baseline);

      fs.appendFileSync(
        path.join(fixture.repoRoot, 'development/platformEnvDefine.js'),
        '\n// changed transformer input\n',
      );
      expect(
        computeConfigInputsDigest(fixture.repoRoot, developmentEnv),
      ).not.toBe(baseline);
    } finally {
      fs.rmSync(fixture.repoRoot, { force: true, recursive: true });
    }
  });

  it('canonicalizes line endings in repository fingerprints', () => {
    const fingerprintRepoRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'onekey-dev-vendor-line-endings-'),
    );
    const relativePath = 'fingerprint.txt';
    const filePath = path.join(fingerprintRepoRoot, relativePath);
    try {
      fs.writeFileSync(filePath, 'first\nsecond\n');
      const lfDigest = hashRepoFiles([relativePath], fingerprintRepoRoot);
      fs.writeFileSync(filePath, 'first\r\nsecond\r\n');
      expect(hashRepoFiles([relativePath], fingerprintRepoRoot)).toBe(lfDigest);
    } finally {
      fs.rmSync(fingerprintRepoRoot, { force: true, recursive: true });
    }
  });

  it('canonicalizes text shell inputs and hashes binary shell inputs byte-for-byte', () => {
    const shellInputRepoRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'onekey-dev-shell-input-bytes-'),
    );
    const textRelativePath = 'input.txt';
    const textPath = path.join(shellInputRepoRoot, textRelativePath);
    const binaryRelativePath = 'debug.keystore';
    const binaryPath = path.join(shellInputRepoRoot, binaryRelativePath);
    try {
      fs.writeFileSync(textPath, 'first\nsecond\n');
      const lfDigest = hashShellInputFiles(
        [textRelativePath],
        shellInputRepoRoot,
      );
      fs.writeFileSync(textPath, 'first\r\nsecond\r\n');
      expect(hashShellInputFiles([textRelativePath], shellInputRepoRoot)).toBe(
        lfDigest,
      );

      fs.writeFileSync(binaryPath, Buffer.from([0x01, 0x0d, 0x0a, 0x02]));
      const crlfDigest = hashShellInputFiles(
        [binaryRelativePath],
        shellInputRepoRoot,
      );
      fs.writeFileSync(binaryPath, Buffer.from([0x01, 0x0a, 0x02]));
      expect(
        hashShellInputFiles([binaryRelativePath], shellInputRepoRoot),
      ).not.toBe(crlfDigest);
    } finally {
      fs.rmSync(shellInputRepoRoot, { force: true, recursive: true });
    }
  });

  it('keeps binary byte changes in the Android shell input key', () => {
    const fixture = createTemporaryRuntimeFixture();
    try {
      const nativeContractKey = computeNativeContractKey(
        'android',
        fixture.repoRoot,
      );
      const keyOptions = {
        nativeContractKey,
        platform: 'android',
        webEmbedInputKey: '1'.repeat(64),
      };
      const keystorePath = path.join(
        fixture.repoRoot,
        'apps/mobile/android/app/debug.keystore',
      );
      const original = fs.readFileSync(keystorePath);
      fs.writeFileSync(
        keystorePath,
        Buffer.concat([original, Buffer.from([0x0d, 0x0a])]),
      );
      const crlfKey = computeShellInputKey(keyOptions, fixture.repoRoot);
      fs.writeFileSync(
        keystorePath,
        Buffer.concat([original, Buffer.from([0x0a])]),
      );
      expect(computeShellInputKey(keyOptions, fixture.repoRoot)).not.toBe(
        crlfKey,
      );
    } finally {
      fs.rmSync(fixture.repoRoot, { force: true, recursive: true });
    }
  });

  it('limits the native contract to ABI and compiled app-native inputs', () => {
    const fixture = createTemporaryRuntimeFixture();
    try {
      const iosInputs = getNativeContractInputPaths('ios', fixture.repoRoot);
      const androidInputs = getNativeContractInputPaths(
        'android',
        fixture.repoRoot,
      );
      expect(iosInputs).toEqual(
        expect.arrayContaining([
          'apps/mobile/ios/AppDelegate.swift',
          'apps/mobile/ios/OneKeyWallet/BootRecoveryKeys.swift',
          'apps/mobile/ios/Podfile.lock',
          'apps/mobile/ios/Podfile.properties.json',
          'apps/mobile/ios/ServiceExtension/NotificationService.m',
          'apps/mobile/package.json',
          'patches/react-native+0.86.2+001+initial.patch',
          'patches/react-native+0.86.2+002+fix-hermes-podspec.patch',
          'yarn.lock',
        ]),
      );
      expect(androidInputs).toEqual(
        expect.arrayContaining([
          'apps/mobile/android/app-update-noop/src/main/java/com/margelo/nitro/reactnativeappupdate/ReactNativeAppUpdatePackage.kt',
          'apps/mobile/android/app/src/debug/java/so/onekey/app/wallet/MainApplication.java',
          'apps/mobile/android/app/src/main/java/so/onekey/app/wallet/BaseMainApplication.java',
          'apps/mobile/android/gradle.properties',
          'apps/mobile/package.json',
          'patches/react-native+0.86.2+001+initial.patch',
          'yarn.lock',
        ]),
      );
      expect(iosInputs).not.toContain(
        'apps/mobile/android/app/src/debug/java/so/onekey/app/wallet/MainApplication.java',
      );
      expect(androidInputs).not.toContain('apps/mobile/ios/AppDelegate.swift');
      for (const inputs of [iosInputs, androidInputs]) {
        expect(inputs).not.toContain('apps/mobile/scripts/native-dev-shell.js');
        expect(inputs).not.toContain('apps/mobile/metro.config.js');
        expect(inputs).not.toContain('patches/electron-updater+6.8.9.patch');
      }
      expect(androidInputs).not.toContain(
        'apps/mobile/android/app/src/main/res/values/strings.xml',
      );
      expect(iosInputs).not.toContain(
        'apps/mobile/ios/en.lproj/InfoPlist.strings',
      );

      const iosBaseline = computeNativeContractKey('ios', fixture.repoRoot);
      const androidBaseline = computeNativeContractKey(
        'android',
        fixture.repoRoot,
      );
      for (const relativePath of [
        'apps/mobile/android/app/src/main/res/values/strings.xml',
        'apps/mobile/ios/en.lproj/InfoPlist.strings',
      ]) {
        const resourcePath = path.join(fixture.repoRoot, relativePath);
        const resource = fs.readFileSync(resourcePath);
        fs.appendFileSync(resourcePath, '\nresource-only change\n');
        expect(computeNativeContractKey('ios', fixture.repoRoot)).toBe(
          iosBaseline,
        );
        expect(computeNativeContractKey('android', fixture.repoRoot)).toBe(
          androidBaseline,
        );
        fs.writeFileSync(resourcePath, resource);
      }

      const patchDirectory = path.join(fixture.repoRoot, 'patches');
      const androidNativePatch = path.join(
        patchDirectory,
        'contract-test-android.patch',
      );
      fs.writeFileSync(
        androidNativePatch,
        'diff --git a/node_modules/example/android/Test.java b/node_modules/example/android/Test.java\n',
      );
      expect(computeNativeContractKey('android', fixture.repoRoot)).not.toBe(
        androidBaseline,
      );
      expect(computeNativeContractKey('ios', fixture.repoRoot)).toBe(
        iosBaseline,
      );
      fs.rmSync(androidNativePatch);

      const iosNativePatch = path.join(
        patchDirectory,
        'contract-test-ios.patch',
      );
      fs.writeFileSync(
        iosNativePatch,
        'diff --git a/node_modules/example/ios/Test.swift b/node_modules/example/ios/Test.swift\n',
      );
      expect(computeNativeContractKey('ios', fixture.repoRoot)).not.toBe(
        iosBaseline,
      );
      expect(computeNativeContractKey('android', fixture.repoRoot)).toBe(
        androidBaseline,
      );
      fs.rmSync(iosNativePatch);

      const jsOnlyPatch = path.join(
        patchDirectory,
        'contract-test-js-only.patch',
      );
      fs.writeFileSync(
        jsOnlyPatch,
        'diff --git a/node_modules/example/index.js b/node_modules/example/index.js\n',
      );
      expect(computeNativeContractKey('ios', fixture.repoRoot)).toBe(
        iosBaseline,
      );
      expect(computeNativeContractKey('android', fixture.repoRoot)).toBe(
        androidBaseline,
      );
      fs.rmSync(jsOnlyPatch);

      const podLockPath = path.join(
        fixture.repoRoot,
        'apps/mobile/ios/Podfile.lock',
      );
      const podLock = fs.readFileSync(podLockPath, 'utf8');
      const changedPodfileChecksum = podLock.replace(
        /^PODFILE CHECKSUM: [0-9a-f]{40}$/mu,
        `PODFILE CHECKSUM: ${'f'.repeat(40)}`,
      );
      expect(changedPodfileChecksum).not.toBe(podLock);
      fs.writeFileSync(podLockPath, changedPodfileChecksum);
      expect(computeNativeContractKey('ios', fixture.repoRoot)).toBe(
        iosBaseline,
      );

      const changedPodResolution = podLock.replace(
        /^(  SPAlert: )[0-9a-f]{40}$/mu,
        `$1${'f'.repeat(40)}`,
      );
      expect(changedPodResolution).not.toBe(podLock);
      fs.writeFileSync(podLockPath, changedPodResolution);
      expect(computeNativeContractKey('ios', fixture.repoRoot)).not.toBe(
        iosBaseline,
      );
      expect(computeNativeContractKey('android', fixture.repoRoot)).toBe(
        androidBaseline,
      );
      fs.writeFileSync(podLockPath, podLock);

      const changedPodCheckout = podLock.replace(
        /^(CHECKOUT OPTIONS:\n  TOCropViewController:\n    :commit: )[0-9a-f]{40}$/mu,
        `$1${'f'.repeat(40)}`,
      );
      expect(changedPodCheckout).not.toBe(podLock);
      fs.writeFileSync(podLockPath, changedPodCheckout);
      expect(computeNativeContractKey('ios', fixture.repoRoot)).not.toBe(
        iosBaseline,
      );
      expect(computeNativeContractKey('android', fixture.repoRoot)).toBe(
        androidBaseline,
      );
      fs.writeFileSync(podLockPath, podLock);

      const webEmbedInputKey = '1'.repeat(64);
      const iosShellInputBaseline = computeShellInputKey(
        {
          nativeContractKey: iosBaseline,
          platform: 'ios',
          webEmbedInputKey,
        },
        fixture.repoRoot,
      );
      const androidShellInputBaseline = computeShellInputKey(
        {
          nativeContractKey: androidBaseline,
          platform: 'android',
          webEmbedInputKey,
        },
        fixture.repoRoot,
      );
      const untrackedBuildOutput = path.join(
        fixture.repoRoot,
        'apps/mobile/android/build-logic/privacy-security-plugins/build/libs/generated.jar',
      );
      fs.mkdirSync(path.dirname(untrackedBuildOutput), { recursive: true });
      fs.writeFileSync(untrackedBuildOutput, Buffer.from([0x0d, 0x0a]));
      expect(
        computeShellInputKey(
          {
            nativeContractKey: androidBaseline,
            platform: 'android',
            webEmbedInputKey,
          },
          fixture.repoRoot,
        ),
      ).toBe(androidShellInputBaseline);

      const untrackedIosOutput = path.join(
        fixture.repoRoot,
        'apps/mobile/ios/OneKeyWallet/build/asset.bin',
      );
      fs.mkdirSync(path.dirname(untrackedIosOutput), { recursive: true });
      fs.writeFileSync(untrackedIosOutput, Buffer.from([0x0d, 0x0a]));
      expect(
        computeShellInputKey(
          {
            nativeContractKey: iosBaseline,
            platform: 'ios',
            webEmbedInputKey,
          },
          fixture.repoRoot,
        ),
      ).toBe(iosShellInputBaseline);

      const untrackedNativeSource = path.join(
        fixture.repoRoot,
        'apps/mobile/android/app/src/main/java/so/onekey/app/wallet/NewModule.java',
      );
      fs.writeFileSync(
        untrackedNativeSource,
        'package so.onekey.app.wallet;\nclass NewModule {}\n',
      );
      expect(computeNativeContractKey('android', fixture.repoRoot)).not.toBe(
        androidBaseline,
      );
      expect(computeNativeContractKey('ios', fixture.repoRoot)).toBe(
        iosBaseline,
      );
      expect(
        computeShellInputKey(
          {
            nativeContractKey: androidBaseline,
            platform: 'android',
            webEmbedInputKey,
          },
          fixture.repoRoot,
        ),
      ).not.toBe(androidShellInputBaseline);
      fs.rmSync(untrackedNativeSource);
      expect(computeNativeContractKey('android', fixture.repoRoot)).toBe(
        androidBaseline,
      );
      expect(
        computeShellInputKey(
          {
            nativeContractKey: androidBaseline,
            platform: 'android',
            webEmbedInputKey,
          },
          fixture.repoRoot,
        ),
      ).toBe(androidShellInputBaseline);

      const trackedBuildSource = path.join(
        fixture.repoRoot,
        'apps/mobile/android/build-logic/privacy-security-plugins/src/main/java/onekey/privacy/security/SecurityPlugin.java',
      );
      const trackedBuildSourceContent = fs.readFileSync(trackedBuildSource);
      fs.appendFileSync(
        trackedBuildSource,
        '\n// changed tracked build source\n',
      );
      expect(computeNativeContractKey('ios', fixture.repoRoot)).toBe(
        iosBaseline,
      );
      expect(computeNativeContractKey('android', fixture.repoRoot)).toBe(
        androidBaseline,
      );
      expect(
        computeShellInputKey(
          {
            nativeContractKey: androidBaseline,
            platform: 'android',
            webEmbedInputKey,
          },
          fixture.repoRoot,
        ),
      ).not.toBe(androidShellInputBaseline);
      fs.writeFileSync(trackedBuildSource, trackedBuildSourceContent);
      expect(
        computeShellInputKey(
          {
            nativeContractKey: androidBaseline,
            platform: 'android',
            webEmbedInputKey,
          },
          fixture.repoRoot,
        ),
      ).toBe(androidShellInputBaseline);

      fs.appendFileSync(
        path.join(fixture.repoRoot, 'apps/mobile/scripts/native-dev-shell.js'),
        '\n// changed host orchestration\n',
      );
      expect(computeNativeContractKey('ios', fixture.repoRoot)).toBe(
        iosBaseline,
      );
      expect(computeNativeContractKey('android', fixture.repoRoot)).toBe(
        androidBaseline,
      );

      fs.appendFileSync(
        path.join(
          fixture.repoRoot,
          '.github/workflows/mobile-dev-shell-ios-simulator.yml',
        ),
        '\n# changed iOS toolchain\n',
      );
      expect(
        computeShellInputKey(
          {
            nativeContractKey: iosBaseline,
            platform: 'ios',
            webEmbedInputKey,
          },
          fixture.repoRoot,
        ),
      ).not.toBe(iosShellInputBaseline);
      expect(
        computeShellInputKey(
          {
            nativeContractKey: androidBaseline,
            platform: 'android',
            webEmbedInputKey,
          },
          fixture.repoRoot,
        ),
      ).toBe(androidShellInputBaseline);

      fs.appendFileSync(
        path.join(
          fixture.repoRoot,
          'apps/mobile/scripts/build-mobile-dev-shell.js',
        ),
        '\n// changed native build orchestration\n',
      );
      expect(computeNativeContractKey('ios', fixture.repoRoot)).toBe(
        iosBaseline,
      );
      expect(
        computeShellInputKey(
          {
            nativeContractKey: androidBaseline,
            platform: 'android',
            webEmbedInputKey,
          },
          fixture.repoRoot,
        ),
      ).not.toBe(androidShellInputBaseline);

      const appDelegatePath = path.join(
        fixture.repoRoot,
        'apps/mobile/ios/AppDelegate.swift',
      );
      const appDelegate = fs.readFileSync(appDelegatePath);
      fs.appendFileSync(appDelegatePath, '\n// changed native runtime\n');
      expect(computeNativeContractKey('ios', fixture.repoRoot)).not.toBe(
        iosBaseline,
      );
      expect(computeNativeContractKey('android', fixture.repoRoot)).toBe(
        androidBaseline,
      );
      expect(
        computeShellInputKey(
          {
            nativeContractKey: iosBaseline,
            platform: 'ios',
            webEmbedInputKey,
          },
          fixture.repoRoot,
        ),
      ).not.toBe(iosShellInputBaseline);
      fs.writeFileSync(appDelegatePath, appDelegate);
      expect(computeNativeContractKey('ios', fixture.repoRoot)).toBe(
        iosBaseline,
      );

      const mobilePackagePath = path.join(
        fixture.repoRoot,
        'apps/mobile/package.json',
      );
      const mobilePackage = JSON.parse(
        fs.readFileSync(mobilePackagePath, 'utf8'),
      );
      mobilePackage.description = 'unrelated metadata';
      fs.writeFileSync(mobilePackagePath, JSON.stringify(mobilePackage));
      expect(computeNativeContractKey('ios', fixture.repoRoot)).toBe(
        iosBaseline,
      );

      mobilePackage.dependencies['expo-constants'] = '57.0.12';
      fs.writeFileSync(mobilePackagePath, JSON.stringify(mobilePackage));
      expect(computeNativeContractKey('ios', fixture.repoRoot)).toBe(
        iosBaseline,
      );

      const yarnLockPath = path.join(fixture.repoRoot, 'yarn.lock');
      const yarnLock = fs.readFileSync(yarnLockPath, 'utf8');
      const changedYarnLock = yarnLock.replace(
        /("react-native@npm:0\.86\.2":[\s\S]*?\n  checksum: )[^\n]+/u,
        `$1${`10/${'a'.repeat(128)}`}`,
      );
      expect(changedYarnLock).not.toBe(yarnLock);
      fs.writeFileSync(yarnLockPath, changedYarnLock);
      expect(computeNativeContractKey('ios', fixture.repoRoot)).not.toBe(
        iosBaseline,
      );
    } finally {
      fs.rmSync(fixture.repoRoot, { force: true, recursive: true });
    }
  });

  it('requires every autolinked native dependency in each ABI descriptor', () => {
    for (const platform of ['android', 'ios']) {
      const configured = [
        ...devVendorConfig.nativeContractDependencies.shared,
        ...devVendorConfig.nativeContractDependencies[platform],
      ].toSorted();
      expect(configured).toEqual(getAutolinkedNativeDependencies(platform));
      expect(
        getNativeContractDescriptor(platform)
          .dependencies.map(({ name }) => name)
          .toSorted(),
      ).toEqual(configured);
    }

    const androidDescriptor = getNativeContractDescriptor('android');
    expect(
      androidDescriptor.dependencies.find(
        ({ name }) => name === '@react-native-async-storage/async-storage',
      ),
    ).toMatchObject({
      resolution: '@onekeyfe/react-native-async-storage@npm:3.0.104',
      version: '3.0.104',
    });
    expect(
      androidDescriptor.dependencies.find(
        ({ name }) => name === 'expo-constants',
      ),
    ).toMatchObject({
      resolution: 'expo-constants@npm:57.0.12',
      version: '57.0.12',
    });
    expect(
      androidDescriptor.dependencies.find(
        ({ name }) => name === 'react-native-ble-plx',
      ),
    ).toMatchObject({
      resolution: 'react-native-ble-plx@npm:3.5.1',
      version: '3.5.1',
    });
  });

  it('computes the release tag without installed JavaScript dependencies', () => {
    const result = spawnSync(
      process.execPath,
      [
        '-e',
        `
          const Module = require('module');
          const path = require('path');
          const builtins = new Set(
            Module.builtinModules.map((name) => name.replace(/^node:/u, '')),
          );
          const load = Module._load;
          Module._load = function guardedLoad(request) {
            const normalized = request.replace(/^node:/u, '');
            if (
              !request.startsWith('.') &&
              !path.isAbsolute(request) &&
              !builtins.has(normalized)
            ) {
              throw new Error('External dependency required: ' + request);
            }
            return load.apply(this, arguments);
          };
          const { getReleaseTag } = require('./apps/mobile/plugins/devVendor');
          process.stdout.write(getReleaseTag());
        `,
      ],
      { cwd: repoRoot, encoding: 'utf8' },
    );
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/^metro-dev-prebundle-v\d+-[0-9a-f]{64}$/u);
  });

  it('isolates release compatibility from workspace-only registry growth', () => {
    const registry = loadRegistry();
    const workspaceOnlyChange = {
      ...registry,
      modules: {
        ...registry.modules,
        'packages/example/new.ts': 8000,
      },
    };
    const vendorChange = {
      ...registry,
      modules: {
        ...registry.modules,
        'node_modules/example/index.js': 50_000,
      },
    };

    expect(computeRegistryInputsDigest(workspaceOnlyChange)).toBe(
      computeRegistryInputsDigest(registry),
    );
    expect(computeRegistryInputsDigest(vendorChange)).not.toBe(
      computeRegistryInputsDigest(registry),
    );
  });

  it('invalidates release compatibility when the transport changes', () => {
    const fixture = createTemporaryRuntimeFixture();
    try {
      const baseline = computeReleaseCompatibilityKey(fixture.repoRoot);
      fs.appendFileSync(
        path.join(fixture.repoRoot, devVendorConfig.releaseFingerprintFiles[0]),
        '\n// changed release transport\n',
      );
      expect(computeReleaseCompatibilityKey(fixture.repoRoot)).not.toBe(
        baseline,
      );
    } finally {
      fs.rmSync(fixture.repoRoot, { force: true, recursive: true });
    }
  });

  it('uses code-point ordering for manifest module paths', () => {
    expect(() =>
      assertSortedUniqueModules([
        { id: 1, path: 'node_modules/Z.js' },
        { id: 2, path: 'node_modules/a.js' },
      ]),
    ).not.toThrow();
    expect(() =>
      assertSortedUniqueModules([
        { id: 2, path: 'node_modules/a.js' },
        { id: 1, path: 'node_modules/Z.js' },
      ]),
    ).toThrow('Manifest modules must be sorted by path');
  });

  it('verifies source and bytecode from an explicit artifact directory', () => {
    const artifactDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'onekey-dev-vendor-manifest-'),
    );
    const source = Buffer.from('common source');
    const bytecode = Buffer.from('common bytecode');
    const modulePath = 'apps/mobile/index.ts';
    const moduleId = loadRegistry().modules[modulePath];
    const modules = [{ id: moduleId, path: modulePath }];
    const prependModules = [
      { id: loadRegistry().modules.__prelude__, path: '__prelude__' },
    ];
    fs.writeFileSync(path.join(artifactDirectory, 'common.js'), source);
    fs.writeFileSync(path.join(artifactDirectory, 'common.hbc'), bytecode);
    fs.mkdirSync(path.join(artifactDirectory, 'stubs'));
    const stubPath = path.join(artifactDirectory, 'stubs', `${moduleId}.js`);
    fs.writeFileSync(stubPath, '');
    const fingerprintFields = {
      schemaVersion: devVendorConfig.SCHEMA_VERSION,
      strategyVersion: devVendorConfig.STRATEGY_VERSION,
      platform: 'ios',
      registryEpoch: loadRegistry().registryEpoch,
      configInputsDigest: computeConfigInputsDigest(),
      modulesDigest: computeModulesDigest(modules),
      nativeContractKey: computeNativeContractKey('ios'),
      modules,
      prependModules,
    };
    const manifest = {
      ...fingerprintFields,
      fingerprint: computeFingerprint(fingerprintFields),
      common: {
        source: {
          file: 'common.js',
          bytes: source.length,
          sha256: sha256(source),
        },
        bytecode: {
          file: 'common.hbc',
          bytes: bytecode.length,
          sha256: sha256(bytecode),
        },
      },
    };

    try {
      expect(
        verifyManifest({
          artifactDirectory,
          manifest,
          platform: 'ios',
          projectRoot: '/unused',
        }),
      ).toBe(manifest);
      expect(() =>
        verifyManifest({
          artifactDirectory,
          manifest: {
            ...manifest,
            prependModules: [{ id: 1, path: '__prelude__' }],
          },
          platform: 'ios',
          projectRoot: '/unused',
        }),
      ).toThrow('Stable module ID mismatch for __prelude__');
      fs.rmSync(stubPath);
      expect(() =>
        verifyManifest({
          artifactDirectory,
          manifest,
          platform: 'ios',
          projectRoot: '/unused',
        }),
      ).toThrow(`External stub is missing for module ${moduleId}`);
    } finally {
      fs.rmSync(artifactDirectory, { force: true, recursive: true });
    }
  });

  it('uses external stubs when serializer sourceUrl lacks resolver options', () => {
    const projectRoot = path.resolve('/tmp/onekey/apps/mobile');
    const entryPoint = path.join(projectRoot, 'background.ts');
    const graph = {
      dependencies: new Map([
        [
          path.join(projectRoot, 'out-dir-bundle/dev-vendor/ios/stubs/4319.js'),
          {},
        ],
        [entryPoint, {}],
      ]),
      transformOptions: { platform: 'ios' },
    };
    const fullBundleOptions = {
      dev: true,
      modulesOnly: false,
      sourceUrl: 'http://localhost:8081/background.bundle?platform=ios',
    };
    const devVendorGraph = inspectDevVendorGraph({
      entryPoint,
      graph,
      projectRoot,
    });

    expect(isDevVendorRequest(fullBundleOptions)).toBe(false);
    expect(devVendorGraph).toEqual({
      platform: 'ios',
      runtimeTarget: 'background',
      stubCount: 1,
    });
    expect(shouldPrependCommon(fullBundleOptions, devVendorGraph)).toBe(true);
    expect(
      composeDevVendorBundle({
        bundleOptions: fullBundleOptions,
        commonSourceCode: 'common',
        devVendorGraph,
        serializedDelta: 'delta',
      }),
    ).toBe('common\ndelta');
    expect(
      composeDevVendorBundle({
        bundleOptions: { ...fullBundleOptions, modulesOnly: true },
        commonSourceCode: 'common',
        devVendorGraph,
        serializedDelta: { code: 'delta', map: 'delta-map' },
      }),
    ).toEqual({ code: 'delta', map: 'delta-map' });
    expect(
      shouldPrependCommon(
        { ...fullBundleOptions, modulesOnly: true },
        devVendorGraph,
      ),
    ).toBe(false);
  });

  it('keeps rewritten URL detection as diagnostics only', () => {
    const fullBundleOptions = {
      dev: true,
      modulesOnly: false,
      sourceUrl:
        'http://localhost:8081/index.bundle?platform=ios&resolver.devVendor=true',
    };

    expect(isDevVendorRequest(fullBundleOptions)).toBe(true);
    expect(
      isDevVendorRequest({
        ...fullBundleOptions,
        sourceUrl: 'http://localhost:8081/index.bundle?platform=ios',
      }),
    ).toBe(false);
  });

  it('strictly validates native fingerprint and runtime requests', () => {
    const manifest = { fingerprint: 'fingerprint-ios' };
    const sessionId = 'wk-111111111111-dev-222222222222-3333333333333333';
    const env = { ONEKEY_DEV_SESSION_ID: sessionId };

    expect(() =>
      assertNativeDevVendorResolverContract({
        customResolverOptions: {
          devVendor: 'true',
          devVendorNative: 'true',
          devVendorFingerprint: 'fingerprint-ios',
          devSessionId: sessionId,
          runtimeTarget: 'main',
        },
        env,
        manifest,
        platform: 'ios',
      }),
    ).not.toThrow();
    expect(() =>
      assertNativeDevVendorResolverContract({
        customResolverOptions: {
          devVendor: 'true',
          devVendorNative: 'true',
          devVendorFingerprint: 'stale',
          devSessionId: sessionId,
          runtimeTarget: 'main',
        },
        env,
        manifest,
        platform: 'ios',
      }),
    ).toThrow('cache fingerprint mismatch');
    expect(() =>
      assertNativeDevVendorResolverContract({
        customResolverOptions: {
          devVendor: 'true',
          devVendorNative: 'true',
          devVendorFingerprint: 'fingerprint-ios',
          devSessionId: sessionId,
          runtimeTarget: 'worker',
        },
        env,
        manifest,
        platform: 'ios',
      }),
    ).toThrow('invalid runtime target');

    expect(() =>
      assertNativeDevVendorResolverContract({
        customResolverOptions: {
          devVendor: 'true',
          devVendorNative: 'true',
          devVendorFingerprint: 'fingerprint-ios',
          devSessionId: sessionId.replace('3333', '4444'),
          runtimeTarget: 'main',
        },
        env,
        manifest,
        platform: 'ios',
      }),
    ).toThrow('does not match this Metro server');
    expect(() =>
      assertNativeDevVendorResolverContract({
        customResolverOptions: {
          devVendor: 'true',
          devVendorNative: 'true',
          devVendorFingerprint: 'fingerprint-ios',
          devSessionId: 'invalid',
          runtimeTarget: 'main',
        },
        env,
        manifest,
        platform: 'ios',
      }),
    ).toThrow('invalid dev session ID');
    expect(() =>
      assertNativeDevVendorResolverContract({
        customResolverOptions: {
          devVendor: 'true',
          devVendorNative: 'true',
          devVendorFingerprint: 'fingerprint-ios',
          devSessionId: sessionId,
          runtimeTarget: 'main',
        },
        env: {},
        manifest,
        platform: 'ios',
      }),
    ).toThrow('no valid ONEKEY_DEV_SESSION_ID');
  });

  it('keeps non-native dev-vendor requests backward compatible', () => {
    expect(() =>
      assertNativeDevVendorResolverContract({
        customResolverOptions: { devVendor: 'true' },
        manifest: { fingerprint: 'fingerprint-ios' },
        platform: 'ios',
      }),
    ).not.toThrow();
  });

  it('registers independent native HMR clients against live Metro graphs', async () => {
    const fingerprint = 'a'.repeat(64);
    const sessionId = 'wk-111111111111-dev-222222222222-3333333333333333';
    const query = new URLSearchParams({
      app: 'so.onekey.app.wallet',
      dev: 'true',
      excludeSource: 'true',
      lazy: 'false',
      minify: 'false',
      modulesOnly: 'true',
      platform: 'ios',
      'resolver.devVendor': 'true',
      'resolver.devVendorFingerprint': fingerprint,
      'resolver.devVendorNative': 'true',
      'resolver.devSessionId': sessionId,
      'resolver.runtimeTarget': 'main',
      runModule: 'true',
      sourcePaths: 'url-server',
      unstable_transformProfile: 'hermes-stable',
    }).toString();
    const liveUrl = `http://localhost:8081/.expo/.virtual-metro-entry.bundle?${query}`;
    const fallbackHmrUrl =
      `http://localhost:8081/hot?bundleEntry=.expo/.virtual-metro-entry.bundle` +
      `&${query}&platform=ios`;
    const metroConfigExport = require('../../metro.config');
    const metroConfig =
      typeof metroConfigExport === 'function'
        ? await metroConfigExport()
        : metroConfigExport;
    const rewrittenLiveUrl = metroConfig.server.rewriteRequestUrl(liveUrl);
    const rewrittenFallbackUrl =
      metroConfig.server.rewriteRequestUrl(fallbackHmrUrl);
    const liveOptions = splitBundleOptions(
      parseBundleOptions(rewrittenLiveUrl, new Set(['android', 'ios'])),
    );
    const canonicalHmrUrl = new URL(liveUrl);
    canonicalHmrUrl.pathname = '/apps/mobile/index.bundle';
    canonicalHmrUrl.searchParams.set('transform.routerRoot', 'app');
    canonicalHmrUrl.searchParams.set('transform.engine', 'hermes');
    canonicalHmrUrl.searchParams.set('transform.bytecode', '1');
    const canonicalHmrOptions = splitBundleOptions(
      parseBundleOptions(
        canonicalHmrUrl.toString(),
        new Set(['android', 'ios']),
      ),
    );
    const backgroundHmrUrl = new URL(liveUrl);
    backgroundHmrUrl.pathname = '/background.bundle';
    backgroundHmrUrl.searchParams.set('resolver.runtimeTarget', 'background');
    backgroundHmrUrl.searchParams.set(
      'resolver.devVendorBackgroundHMR',
      'true',
    );
    const backgroundHmrOptions = splitBundleOptions(
      parseBundleOptions(
        backgroundHmrUrl.toString(),
        new Set(['android', 'ios']),
      ),
    );
    const backgroundHmrRegistrationUrl = new URL(backgroundHmrUrl);
    backgroundHmrRegistrationUrl.pathname = '/apps/mobile/background.bundle';
    const backgroundHmrRegistrationOptions = splitBundleOptions(
      parseBundleOptions(
        backgroundHmrRegistrationUrl.toString(),
        new Set(['android', 'ios']),
      ),
    );
    const backgroundHmrDeltaUrl = new URL(backgroundHmrRegistrationUrl);
    backgroundHmrDeltaUrl.searchParams.set('shallow', 'true');
    const backgroundHmrDeltaOptions = splitBundleOptions(
      parseBundleOptions(
        backgroundHmrDeltaUrl.toString(),
        new Set(['android', 'ios']),
      ),
    );
    const backgroundWithoutHmrUrl = new URL(backgroundHmrUrl);
    backgroundWithoutHmrUrl.searchParams.delete(
      'resolver.devVendorBackgroundHMR',
    );
    const backgroundWithoutHmrOptions = splitBundleOptions(
      parseBundleOptions(
        backgroundWithoutHmrUrl.toString(),
        new Set(['android', 'ios']),
      ),
    );

    expect(fs.existsSync(path.join(repoRoot, 'apps/mobile/index.ts'))).toBe(
      true,
    );
    expect(rewrittenLiveUrl).toContain('/apps/mobile/index.bundle?');
    expect(rewrittenLiveUrl).toContain('transform.routerRoot=app');
    expect(rewrittenLiveUrl).toContain('transform.engine=hermes');
    expect(rewrittenFallbackUrl).toContain(
      'bundleEntry=.expo/.virtual-metro-entry.bundle',
    );
    expect(rewrittenFallbackUrl).not.toContain('transform.routerRoot=app');
    expect(liveOptions.entryFile).toBe('./apps/mobile/index');
    expect(liveOptions.transformOptions.customTransformOptions).toEqual({
      bytecode: '1',
      engine: 'hermes',
      routerRoot: 'app',
    });
    expect(canonicalHmrOptions).toEqual(liveOptions);
    expect(backgroundHmrOptions.entryFile).toBe('./background');
    expect(backgroundHmrRegistrationOptions.entryFile).toBe(
      './apps/mobile/background',
    );
    expect(backgroundHmrRegistrationOptions.resolverOptions).toEqual(
      backgroundHmrOptions.resolverOptions,
    );
    expect(backgroundHmrDeltaOptions.entryFile).toBe(
      './apps/mobile/background',
    );
    expect(backgroundHmrDeltaOptions.graphOptions.shallow).toBe(true);
    expect(
      shouldRetainModulesOnlyGraphForHmr(liveOptions.resolverOptions),
    ).toBe(true);
    expect(
      shouldRetainModulesOnlyGraphForHmr(
        backgroundWithoutHmrOptions.resolverOptions,
      ),
    ).toBe(false);
    expect(
      shouldRetainModulesOnlyGraphForHmr(backgroundHmrOptions.resolverOptions),
    ).toBe(true);
    expect(
      shouldRetainModulesOnlyGraphForHmr({
        customResolverOptions: {
          devVendorBackgroundHMR: 'true',
          runtimeTarget: 'background',
        },
      }),
    ).toBe(false);
  });

  it('refreshes the cached dev server from native runtime delta URLs', () => {
    const { getDevServer, runtimeGlobal } = loadGetDevServer(
      'file:///tmp/onekey-dev-vendor-common.hbc',
    );
    expect(getDevServer()).toEqual({
      bundleLoadedFromServer: false,
      fullBundleUrl: null,
      url: 'http://localhost:8081/',
    });

    const firstMainURL =
      'http://localhost:8081/.expo/.virtual-metro-entry.bundle' +
      '?resolver.devVendorNative=true&resolver.runtimeTarget=main';
    runtimeGlobal.__ONEKEY_DEV_VENDOR_FULL_BUNDLE_URL__ = firstMainURL;
    expect(getDevServer()).toEqual({
      bundleLoadedFromServer: true,
      fullBundleUrl: firstMainURL,
      url: 'http://localhost:8081/',
    });

    const reloadedMainURL = firstMainURL.replace('localhost', '127.0.0.1');
    runtimeGlobal.__ONEKEY_DEV_VENDOR_FULL_BUNDLE_URL__ = reloadedMainURL;
    expect(getDevServer()).toEqual({
      bundleLoadedFromServer: true,
      fullBundleUrl: reloadedMainURL,
      url: 'http://127.0.0.1:8081/',
    });

    const backgroundRuntime = loadGetDevServer(
      'file:///tmp/onekey-dev-vendor-common.hbc',
    );
    const backgroundURL = firstMainURL.replace(
      'runtimeTarget=main',
      'runtimeTarget=background',
    );
    backgroundRuntime.runtimeGlobal.__ONEKEY_DEV_VENDOR_FULL_BUNDLE_URL__ =
      backgroundURL;
    expect(backgroundRuntime.getDevServer()).toEqual({
      bundleLoadedFromServer: true,
      fullBundleUrl: backgroundURL,
      url: 'http://localhost:8081/',
    });

    const invalidRuntime = loadGetDevServer(
      'file:///tmp/onekey-dev-vendor-common.hbc',
    );
    invalidRuntime.runtimeGlobal.__ONEKEY_DEV_VENDOR_FULL_BUNDLE_URL__ =
      firstMainURL.replace('runtimeTarget=main', 'runtimeTarget=worker');
    expect(invalidRuntime.getDevServer().bundleLoadedFromServer).toBe(false);
  });

  it('quotes iOS bundle phase tool paths containing spaces', () => {
    const { script, shellPath } = loadIOSMainBundlePhase();
    const temporaryDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'onekey dev vendor xcode '),
    );
    const nodeBinary = path.join(temporaryDirectory, 'Node Binary');
    const sentryScript = path.join(temporaryDirectory, 'Sentry Script.sh');
    const reactNativeScript = path.join(
      temporaryDirectory,
      'React Native Script.sh',
    );
    const captureFile = path.join(temporaryDirectory, 'Captured Argument.txt');

    try {
      fs.writeFileSync(
        nodeBinary,
        '#!/bin/sh\n' +
          'case "$*" in\n' +
          '  *sentry*) printf "%s\\n" "$MOCK_SENTRY_SCRIPT" ;;\n' +
          '  *) printf "%s\\n" "$MOCK_REACT_NATIVE_SCRIPT" ;;\n' +
          'esac\n',
      );
      fs.chmodSync(nodeBinary, 0o755);
      fs.writeFileSync(
        sentryScript,
        '#!/bin/sh\nprintf "sentry:%s\\n" "$1" > "$MOCK_CAPTURE_FILE"\n',
      );
      fs.writeFileSync(
        reactNativeScript,
        '#!/bin/sh\nprintf "react-native\\n" > "$MOCK_CAPTURE_FILE"\n',
      );

      const runInvocation = (sentryDisabled) =>
        spawnSync(shellPath, ['-c', script], {
          encoding: 'utf8',
          env: {
            ...process.env,
            BUNDLE_COMMAND: 'export:embed',
            CLI_PATH: '/tmp/mock-expo-cli',
            CONFIGURATION: 'Release',
            ENTRY_FILE: 'index.js',
            MOCK_CAPTURE_FILE: captureFile,
            MOCK_REACT_NATIVE_SCRIPT: reactNativeScript,
            MOCK_SENTRY_SCRIPT: sentryScript,
            NODE_BINARY: nodeBinary,
            PODS_ROOT: path.join(temporaryDirectory, 'Pods'),
            PROJECT_DIR: path.join(repoRoot, 'apps/mobile/ios'),
            SENTRY_DISABLE_AUTO_UPLOAD: sentryDisabled ? 'true' : 'false',
          },
        });

      const disabledResult = runInvocation(true);
      expect(disabledResult.status).toBe(0);
      expect(disabledResult.stderr).toBe('');
      expect(fs.readFileSync(captureFile, 'utf8').trim()).toBe('react-native');

      const enabledResult = runInvocation(false);
      expect(enabledResult.status).toBe(0);
      expect(enabledResult.stderr).toBe('');
      expect(fs.readFileSync(captureFile, 'utf8').trim()).toBe(
        `sentry:${reactNativeScript}`,
      );
    } finally {
      fs.rmSync(temporaryDirectory, { force: true, recursive: true });
    }
  });

  it('resolves background assets from Metro after local common startup', () => {
    const { resolveAssetSource, runtimeGlobal } = loadResolveAssetSource(
      'onekey-dev-vendor-assert-background.js',
    );
    expect(resolveAssetSource(1)).toEqual({
      scriptBundleURL: 'file://',
      serverURL: null,
    });

    const backgroundURL =
      'http://localhost:8081/background.bundle' +
      '?resolver.devVendorNative=true&resolver.runtimeTarget=background';
    runtimeGlobal.__ONEKEY_DEV_VENDOR_FULL_BUNDLE_URL__ = backgroundURL;
    expect(resolveAssetSource(1)).toEqual({
      scriptBundleURL: 'file://',
      serverURL: 'http://localhost:8081/',
    });

    const reloadedURL = backgroundURL.replace('localhost', '127.0.0.1');
    runtimeGlobal.__ONEKEY_DEV_VENDOR_FULL_BUNDLE_URL__ = reloadedURL;
    expect(resolveAssetSource(1)).toEqual({
      scriptBundleURL: 'file://',
      serverURL: 'http://127.0.0.1:8081/',
    });
  });

  it('rejects native requests when the Metro experiment is disabled', () => {
    expect(() =>
      assertNativeDevVendorServerEnabled({ devVendorNative: 'true' }, false),
    ).toThrow('without ONEKEY_DEV_VENDOR=true');
    expect(() =>
      assertNativeDevVendorServerEnabled({ devVendor: 'true' }, false),
    ).not.toThrow();
  });
});
