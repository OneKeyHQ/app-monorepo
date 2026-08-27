const path = require('path');

const {
  computeFingerprint,
  getDevVendorStubModuleId,
  isDevVendorEnabled,
  isDevVendorRequest,
  shouldPrependCommon,
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

  it('recognizes rewritten Metro URLs and keeps modulesOnly responses as deltas', () => {
    const fullBundleOptions = {
      dev: true,
      modulesOnly: false,
      sourceUrl:
        'http://localhost:8081/index.bundle?platform=ios&resolver.devVendor=true',
    };

    expect(isDevVendorRequest(fullBundleOptions)).toBe(true);
    expect(shouldPrependCommon(fullBundleOptions)).toBe(true);
    expect(
      shouldPrependCommon({ ...fullBundleOptions, modulesOnly: true }),
    ).toBe(false);
    expect(
      isDevVendorRequest({
        ...fullBundleOptions,
        sourceUrl: 'http://localhost:8081/index.bundle?platform=ios',
      }),
    ).toBe(false);
  });
});
