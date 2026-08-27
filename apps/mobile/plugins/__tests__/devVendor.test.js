const fs = require('fs');
const os = require('os');
const path = require('path');

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

  it('rejects native requests when the Metro experiment is disabled', () => {
    expect(() =>
      assertNativeDevVendorServerEnabled({ devVendorNative: 'true' }, false),
    ).toThrow('without ONEKEY_DEV_VENDOR=true');
    expect(() =>
      assertNativeDevVendorServerEnabled({ devVendor: 'true' }, false),
    ).not.toThrow();
  });
});
