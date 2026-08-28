const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');

const babel = require('@babel/core');

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
  composeDevVendorBundle,
  getDevVendorStubModuleId,
  isDevVendorEnabled,
  isDevVendorRequest,
  inspectDevVendorGraph,
  sha256,
  shouldPrependCommon,
  verifyManifest,
} = require('../devVendor');

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

function loadIOSMainBundlePhaseScript() {
  const project = fs.readFileSync(
    path.join(
      repoRoot,
      'apps/mobile/ios/OneKeyWallet.xcodeproj/project.pbxproj',
    ),
    'utf8',
  );
  const phaseStart = project.indexOf(
    'EA7958392B70B02A00E0382F /* Bundle React Native code and images */ = {',
  );
  const phaseEnd = project.indexOf('\n\t\t};', phaseStart);
  const phase = project.slice(phaseStart, phaseEnd);
  const scriptMatch = phase.match(/shellScript = ("(?:\\.|[^"\\])*");/);
  if (!scriptMatch) {
    throw new Error('Unable to read the iOS main bundle build phase');
  }
  return JSON.parse(scriptMatch[1]);
}

describe('devVendor', () => {
  it('only enables the experiment for an explicit true value', () => {
    expect(isDevVendorEnabled({ ONEKEY_DEV_VENDOR: 'true' })).toBe(true);
    expect(isDevVendorEnabled({ ONEKEY_DEV_VENDOR: 'false' })).toBe(false);
    expect(isDevVendorEnabled({})).toBe(false);
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

  it('creates a deterministic fingerprint from ordered manifest fields', () => {
    const fields = {
      schemaVersion: 1,
      strategyVersion: 1,
      platform: 'ios',
      registryEpoch: 1,
      configInputsDigest: 'config',
      modulesDigest: 'modules',
      modules: [
        { id: 1, path: 'node_modules/a.js', ignored: 'value' },
        { id: 2, path: 'node_modules/b.js' },
      ],
    };

    expect(computeFingerprint(fields)).toBe(computeFingerprint(fields));
    expect(
      computeFingerprint({ ...fields, modulesDigest: 'changed' }),
    ).not.toBe(computeFingerprint(fields));
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
    const modules = [{ id: 4, path: 'apps/mobile/index.ts' }];
    fs.writeFileSync(path.join(artifactDirectory, 'common.js'), source);
    fs.writeFileSync(path.join(artifactDirectory, 'common.hbc'), bytecode);
    fs.mkdirSync(path.join(artifactDirectory, 'stubs'));
    fs.writeFileSync(path.join(artifactDirectory, 'stubs/4.js'), '');
    const fingerprintFields = {
      schemaVersion: devVendorConfig.SCHEMA_VERSION,
      strategyVersion: devVendorConfig.STRATEGY_VERSION,
      platform: 'ios',
      registryEpoch: 1,
      configInputsDigest: computeConfigInputsDigest(),
      modulesDigest: computeModulesDigest(modules),
      modules,
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
      fs.rmSync(path.join(artifactDirectory, 'stubs/4.js'));
      expect(() =>
        verifyManifest({
          artifactDirectory,
          manifest,
          platform: 'ios',
          projectRoot: '/unused',
        }),
      ).toThrow('External stub is missing for module 4');
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

    expect(() =>
      assertNativeDevVendorResolverContract({
        customResolverOptions: {
          devVendorNative: 'true',
          devVendorFingerprint: 'fingerprint-ios',
          runtimeTarget: 'main',
        },
        manifest,
        platform: 'ios',
      }),
    ).not.toThrow();
    expect(() =>
      assertNativeDevVendorResolverContract({
        customResolverOptions: {
          devVendorNative: 'true',
          devVendorFingerprint: 'stale',
          runtimeTarget: 'main',
        },
        manifest,
        platform: 'ios',
      }),
    ).toThrow('cache fingerprint mismatch');
    expect(() =>
      assertNativeDevVendorResolverContract({
        customResolverOptions: {
          devVendorNative: 'true',
          devVendorFingerprint: 'fingerprint-ios',
          runtimeTarget: 'worker',
        },
        manifest,
        platform: 'ios',
      }),
    ).toThrow('invalid runtime target');
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

    const splitBundlePatch = fs.readFileSync(
      path.join(
        repoRoot,
        'patches/@onekeyfe+react-native-split-bundle-loader+3.0.90.patch',
      ),
      'utf8',
    );
    expect(splitBundlePatch).toContain(
      'strongHost.bundleManager.bundleURL = bundleURL',
    );
    expect(splitBundlePatch).toContain(
      'NSString *sourceURL = hmrBundleURL.absoluteString',
    );
    expect(splitBundlePatch).toContain('hmrBundleURL.absoluteString');
    expect(splitBundlePatch).toContain('__ONEKEY_DEV_VENDOR_FULL_BUNDLE_URL__');
    expect(
      splitBundlePatch.indexOf('runtime.global().setProperty('),
    ).toBeLessThan(
      splitBundlePatch.indexOf('runtime.evaluateJavaScript(buffer'),
    );
    const reactNativePatch = fs.readFileSync(
      path.join(repoRoot, 'patches/react-native+0.86.2.patch'),
      'utf8',
    );
    expect(reactNativePatch).toContain('fullBundleUrlOverride ??');
    expect(reactNativePatch).toContain('resolver.devVendorNative=true');
    expect(reactNativePatch).toContain(
      'resolver\\.runtimeTarget=(?:main|background)',
    );
    expect(reactNativePatch).toContain('__ONEKEY_DEV_VENDOR_FULL_BUNDLE_URL__');
    expect(reactNativePatch).toContain('Libraries/Image/resolveAssetSource.js');
    expect(reactNativePatch).toContain(
      'resolve live dev-vendor assets from Metro',
    );
    expect(reactNativePatch).not.toContain(
      'contains("resolver.devVendor=true")',
    );
    const metroPatch = fs.readFileSync(
      path.join(repoRoot, 'patches/metro+0.84.4.patch'),
      'utf8',
    );
    expect(metroPatch).toContain(
      '!shouldRetainModulesOnlyGraphForHmr(resolverOptions)',
    );
    expect(metroPatch).toContain('devVendorBackgroundHMR === "true"');
    const backgroundThreadPatch = fs.readFileSync(
      path.join(
        repoRoot,
        'patches/@onekeyfe+react-native-background-thread+3.0.90.patch',
      ),
      'utf8',
    );
    const backgroundOverrideIndex = backgroundThreadPatch.indexOf(
      '__ONEKEY_DEV_VENDOR_FULL_BUNDLE_URL__',
    );
    expect(backgroundOverrideIndex).toBeGreaterThan(-1);
    expect(backgroundThreadPatch).toContain(
      'org.json.JSONObject.quote(entryURL)',
    );
    expect(backgroundThreadPatch).toMatch(
      /assertionFile\.absolutePath,\n\+\s+entryURL,/,
    );
    expect(backgroundThreadPatch).not.toContain(
      '"onekey-dev-vendor-assert-background.js",',
    );
    expect(backgroundThreadPatch).toContain('HMRClient');
    expect(backgroundThreadPatch).toContain(
      'private interface HMRClient : JavaScriptModule',
    );
    expect(backgroundThreadPatch).not.toContain(
      'import com.facebook.react.devsupport.HMRClient',
    );
    expect(backgroundThreadPatch).toContain('fullBundleUrlOverride: String?');
    expect(backgroundThreadPatch).toContain(
      'markBackgroundRunnerFailed(t, bgStartTime, runtimeGeneration)',
    );
    expect(backgroundThreadPatch).toContain(
      'bgReactHost?.currentReactContext !== context',
    );
    expect(backgroundThreadPatch).toContain(
      'nativeExecuteWork(ptr, workId, isMain, runtimeGeneration)',
    );
    expect(backgroundThreadPatch).toContain(
      'runtimeGeneration != gBgRuntimeGeneration',
    );
    expect(backgroundThreadPatch).toContain(
      'GetMethodID(cls, "scheduleOnJSThread", "(ZJJ)Z")',
    );
    const androidBackgroundRestartIndex = backgroundThreadPatch.indexOf(
      'val invalidatedGeneration = backgroundRuntimeGeneration.incrementAndGet()',
    );
    const androidBackgroundPointerClearIndex = backgroundThreadPatch.indexOf(
      'bgRuntimePtr = 0',
      androidBackgroundRestartIndex,
    );
    const androidBackgroundInvalidateIndex = backgroundThreadPatch.indexOf(
      'nativeInvalidateSharedRpc("background", invalidatedGeneration)',
      androidBackgroundRestartIndex,
    );
    expect(androidBackgroundRestartIndex).toBeGreaterThan(-1);
    expect(androidBackgroundPointerClearIndex).toBeGreaterThan(
      androidBackgroundRestartIndex,
    );
    expect(androidBackgroundInvalidateIndex).toBeGreaterThan(
      androidBackgroundPointerClearIndex,
    );
    expect(backgroundThreadPatch).toContain(
      '__ONEKEY_BACKGROUND_RUNTIME_GENERATION__',
    );
    expect(backgroundThreadPatch).toContain(
      '[BackgroundHMR] client setup queued',
    );
    expect(backgroundThreadPatch).toContain(
      '@"/apps/mobile/background.bundle"',
    );
    expect(backgroundThreadPatch).toContain(
      '.path("/apps/mobile/background.bundle")',
    );
    expect(backgroundThreadPatch).toContain(
      'hmrRegistrationURL.absoluteString',
    );
    expect(backgroundThreadPatch).toContain('hmrRegistrationUri.toString()');
    expect(backgroundThreadPatch).toContain('loadBundleAtURL:entryURL');
    expect(backgroundThreadPatch).toContain(
      'val connection = java.net.URL(entryURL).openConnection()',
    );
    expect(backgroundThreadPatch).toContain(
      'if (_devVendorBackgroundHMREnabled)',
    );
    expect(backgroundThreadPatch).toContain(
      'nativeInvalidateSharedRpc("background")',
    );
    const iosBackgroundStartIndex = backgroundThreadPatch.indexOf(
      'if (_devVendorEntryURL)',
    );
    const iosBackgroundEvaluateQueueIndex = backgroundThreadPatch.indexOf(
      'finishHostStartWithBundleData:nil',
      iosBackgroundStartIndex,
    );
    const iosBackgroundHMRSetupIndex = backgroundThreadPatch.indexOf(
      'callFunctionOnJSModule:@"HMRClient"',
      iosBackgroundStartIndex,
    );
    expect(iosBackgroundEvaluateQueueIndex).toBeGreaterThan(
      iosBackgroundStartIndex,
    );
    expect(iosBackgroundHMRSetupIndex).toBeGreaterThan(
      iosBackgroundEvaluateQueueIndex,
    );
    expect(
      backgroundThreadPatch.indexOf(
        'runtime.evaluateJavaScript(buffer',
        backgroundOverrideIndex,
      ),
    ).toBeGreaterThan(backgroundOverrideIndex);
    const expoPatch = fs.readFileSync(
      path.join(repoRoot, 'patches/expo+57.0.14.patch'),
      'utf8',
    );
    expect(expoPatch).toContain('org.json.JSONObject.quote(hmrEntryUrl)');
    expect(expoPatch).toMatch(
      /assertionFile\.absolutePath,\n\+\s+hmrEntryUrl,/,
    );
    expect(expoPatch).not.toContain('"onekey-dev-vendor-assert-main.js",');
    expect(expoPatch).toContain(
      '__ONEKEY_DEV_VENDOR_FULL_BUNDLE_URL__=$quotedEntryUrl',
    );
    expect(expoPatch).toContain('.path("/apps/mobile/index.bundle")');
    expect(expoPatch).toContain('URL(config.entryUrl).openConnection()');
    expect(expoPatch).toContain('return hmrEntryUrl');
    const appDelegateSource = fs.readFileSync(
      path.join(repoRoot, 'apps/mobile/ios/AppDelegate.swift'),
      'utf8',
    );
    expect(appDelegateSource).toContain(
      'components.path = "/apps/mobile/index.bundle"',
    );
    expect(appDelegateSource).toContain('hmrBundleURL: mainHMRURL');
    expect(appDelegateSource).toContain(
      'ProcessInfo.processInfo.environment["ONEKEY_METRO_HOST"]',
    );
    expect(appDelegateSource).toContain('?? "127.0.0.1"');
    expect(appDelegateSource).toContain(
      'values["resolver.devVendorBackgroundHMR"] = "true"',
    );
    expect(reactNativePatch).toContain("restart('background'");
    expect(reactNativePatch).toContain(
      "global['__ONEKEY_RUNTIME_TARGET__'] === 'background'",
    );
    expect(reactNativePatch).toContain(
      "require('../TurboModule/TurboModuleRegistry')",
    );
    expect(reactNativePatch).not.toContain(
      "require('../TurboModule/TurboModuleRegistry').default",
    );
    const androidApplicationSource = fs.readFileSync(
      path.join(
        repoRoot,
        'apps/mobile/android/app/src/main/java/so/onekey/app/wallet/MainApplication.java',
      ),
      'utf8',
    );
    expect(androidApplicationSource).toContain(
      'resolver.devVendorBackgroundHMR',
    );
    expect(androidApplicationSource).toContain('BuildConfig.ONEKEY_DEV_BG_HMR');
    const bridgingHeader = fs.readFileSync(
      path.join(
        repoRoot,
        'apps/mobile/ios/OneKeyWallet/OneKeyWallet-Bridging-Header.h',
      ),
      'utf8',
    );
    expect(bridgingHeader).toMatch(
      /loadDevVendorEntryBundle:\(NSURL \*\)bundleURL\s+hmrBundleURL:\(NSURL \*\)hmrBundleURL\s+fingerprint:/,
    );
  });

  it('persists iOS background HMR only for the current dev-vendor fingerprint', () => {
    const appDelegateSource = fs.readFileSync(
      path.join(repoRoot, 'apps/mobile/ios/AppDelegate.swift'),
      'utf8',
    );
    expect(appDelegateSource).toContain(
      '"onekey_dev_vendor_background_hmr_fingerprint"',
    );
    expect(appDelegateSource).toContain(
      'defaults.set(fingerprint, forKey: devBackgroundHMRFingerprintDefaultsKey)',
    );
    expect(appDelegateSource).toContain(
      'defaults.removeObject(forKey: devBackgroundHMRFingerprintDefaultsKey)',
    );
    expect(appDelegateSource).toContain('persistedFingerprint == fingerprint');
    expect(appDelegateSource).toContain(
      'isDevBackgroundHMREnabled(fingerprint: fingerprint)',
    );
    expect(appDelegateSource).toContain(
      'fingerprint: devVendorBundleInfo.fingerprint',
    );
    expect(appDelegateSource).toMatch(
      /if let explicitValue = explicitDevBackgroundHMRValue\(\) \{[\s\S]*?return explicitValue/,
    );
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
    const script = loadIOSMainBundlePhaseScript();
    const invocation = script.slice(script.lastIndexOf('SENTRY_XCODE_SCRIPT='));
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
        spawnSync('/bin/bash', ['-c', invocation], {
          encoding: 'utf8',
          env: {
            ...process.env,
            MOCK_CAPTURE_FILE: captureFile,
            MOCK_REACT_NATIVE_SCRIPT: reactNativeScript,
            MOCK_SENTRY_SCRIPT: sentryScript,
            NODE_BINARY: nodeBinary,
            SENTRY_DISABLE_AUTO_UPLOAD: sentryDisabled ? 'true' : 'false',
          },
        });

      expect(invocation).not.toContain('`');
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
