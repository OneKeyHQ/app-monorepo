const os = require('os');
const path = require('path');

const fs = require('fs-extra');

const { REPO_ROOT } = require('../../plugins/moduleIdRegistry');
const {
  addObservedModulePaths,
  createCommonModuleFilter,
  createModuleRecords,
  parseArgs,
  preparePlatform,
  selectClosedVendorModules,
  verifyAndReplaceDirectory,
} = require('../build-dev-vendor');
const { buildModuleSignature } = require('../unionBuildHelpers');

function createModule(code, dependencies = []) {
  return {
    dependencies: new Map(
      dependencies.map(({ asyncType = null, path: absolutePath }, index) => [
        String(index),
        {
          absolutePath,
          data: { data: { asyncType } },
        },
      ]),
    ),
    inverseDependencies: new Set(),
    output: [{ type: 'js/module', data: { code } }],
  };
}

describe('build-dev-vendor', () => {
  it('parses platform and check modes', () => {
    expect(parseArgs(['--platform', 'all', '--check'])).toEqual({
      check: true,
      platforms: ['ios', 'android'],
      prepare: false,
      registryUpdate: false,
    });
    expect(parseArgs(['--platform', 'android', '--update-registry'])).toEqual({
      check: false,
      platforms: ['android'],
      prepare: false,
      registryUpdate: true,
    });
    expect(parseArgs(['--platform', 'all', '--prepare'])).toEqual({
      check: false,
      platforms: ['ios', 'android'],
      prepare: true,
      registryUpdate: false,
    });
    expect(() => parseArgs(['--platform', 'web'])).toThrow(
      '--platform must be android, ios, or all',
    );
    expect(() => parseArgs(['--check', '--prepare'])).toThrow(
      '--check, --prepare, and --update-registry cannot be used together',
    );
  });

  it('rebuilds only an invalid platform and verifies the replacement', async () => {
    const check = jest
      .fn()
      .mockImplementationOnce(() => {
        throw new TypeError('fingerprint mismatch');
      })
      .mockImplementationOnce(() => {});
    const build = jest.fn().mockResolvedValue(undefined);
    const restore = jest.fn().mockRejectedValue(new Error('release missing'));

    await expect(
      preparePlatform('android', { build, check, restore }),
    ).resolves.toEqual({
      fallback: true,
      fallbackReason: 'release missing',
      localCacheReason: 'fingerprint mismatch',
      source: 'local-build',
    });
    expect(build).toHaveBeenCalledTimes(1);
    expect(build).toHaveBeenCalledWith('android');
    expect(restore).toHaveBeenCalledWith('android');
    expect(check).toHaveBeenCalledTimes(2);
  });

  it('skips a valid platform during prepare', async () => {
    const check = jest.fn();
    const build = jest.fn();
    const restore = jest.fn();

    await expect(
      preparePlatform('ios', { build, check, restore }),
    ).resolves.toEqual({ fallback: false, source: 'local-cache' });
    expect(check).toHaveBeenCalledTimes(1);
    expect(build).not.toHaveBeenCalled();
    expect(restore).not.toHaveBeenCalled();
  });

  it('restores a compatible public release before rebuilding locally', async () => {
    const check = jest
      .fn()
      .mockImplementationOnce(() => {
        throw new TypeError('cache missing');
      })
      .mockImplementationOnce(() => {});
    const build = jest.fn();
    const restore = jest
      .fn()
      .mockResolvedValue({ tagName: 'metro-dev-prebundle-v1-test' });

    await expect(
      preparePlatform('ios', { build, check, restore }),
    ).resolves.toEqual({
      fallback: false,
      source: 'remote',
      tag: 'metro-dev-prebundle-v1-test',
    });
    expect(restore).toHaveBeenCalledWith('ios');
    expect(check).toHaveBeenCalledTimes(2);
    expect(build).not.toHaveBeenCalled();
  });

  it('does not silently rebuild an explicitly remote vendor', async () => {
    const check = jest.fn(() => {
      throw new TypeError('cache missing');
    });
    const build = jest.fn();
    const restoreError = new Error('remote missing');
    const restore = jest.fn().mockRejectedValue(restoreError);

    await expect(
      preparePlatform('android', {
        build,
        check,
        restore,
        source: 'remote',
      }),
    ).rejects.toBe(restoreError);
    expect(build).not.toHaveBeenCalled();
  });

  it('restores an explicitly remote vendor even when the local cache is valid', async () => {
    const check = jest.fn();
    const build = jest.fn();
    const restore = jest
      .fn()
      .mockResolvedValue({ tagName: 'metro-dev-prebundle-v2-exact' });

    await expect(
      preparePlatform('android', {
        build,
        check,
        restore,
        source: 'remote',
      }),
    ).resolves.toEqual({
      fallback: false,
      source: 'remote',
      tag: 'metro-dev-prebundle-v2-exact',
    });
    expect(restore).toHaveBeenCalledWith('android');
    expect(check).toHaveBeenCalledTimes(1);
    expect(build).not.toHaveBeenCalled();
  });

  it('builds directly when the local vendor is explicitly requested', async () => {
    const check = jest.fn();
    const build = jest.fn();
    const restore = jest.fn();

    await expect(
      preparePlatform('ios', { build, check, restore, source: 'local' }),
    ).resolves.toEqual({ fallback: false, source: 'local-build' });
    expect(build).toHaveBeenCalledWith('ios');
    expect(check).toHaveBeenCalledWith('ios');
    expect(restore).not.toHaveBeenCalled();
  });

  it('reports the failed target when prepare cannot rebuild', async () => {
    const error = new TypeError('module registry is stale');
    const check = jest.fn(() => {
      throw error;
    });
    const build = jest.fn().mockRejectedValue(error);
    const restore = jest.fn().mockRejectedValue(new Error('release missing'));
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      await expect(
        preparePlatform('ios', { build, check, restore }),
      ).rejects.toBe(error);
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining('Prepare failed for platform=ios'),
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it('collects every main/background graph and prepend path', () => {
    const observed = new Set();
    addObservedModulePaths(
      observed,
      {
        dependencies: new Map([
          ['/repo/background.js', createModule('background')],
          ['/repo/shared.js', createModule('shared')],
        ]),
      },
      [{ path: '__prelude__' }, { path: '/repo/polyfill.js' }],
    );
    addObservedModulePaths(
      observed,
      {
        dependencies: new Map([
          ['/repo/main.js', createModule('main')],
          ['/repo/shared.js', createModule('shared')],
        ]),
      },
      [{ path: '__prelude__' }],
    );

    expect([...observed].toSorted()).toEqual([
      '/repo/background.js',
      '/repo/main.js',
      '/repo/polyfill.js',
      '/repo/shared.js',
      '__prelude__',
    ]);
  });

  it('includes Metro prepends and selected vendor modules in common only', () => {
    const filter = createCommonModuleFilter({
      prepend: [
        { path: '__prelude__' },
        { path: '/repo/node_modules/metro-runtime/require.js' },
      ],
      selectedModules: new Set(['/repo/node_modules/react/index.js']),
    });

    expect(filter('__prelude__')).toBe(true);
    expect(filter('/repo/node_modules/metro-runtime/require.js')).toBe(true);
    expect(filter('/repo/node_modules/react/index.js')).toBe(true);
    expect(filter('/repo/apps/mobile/delta-only.js')).toBe(false);
  });

  it('sorts manifest records with the shared code-point comparator', () => {
    const upperKey = 'node_modules/Z.js';
    const lowerKey = 'node_modules/a.js';
    const records = createModuleRecords(
      new Set([
        path.resolve(REPO_ROOT, lowerKey),
        path.resolve(REPO_ROOT, upperKey),
      ]),
      {
        modules: { [lowerKey]: 2, [upperKey]: 1 },
      },
    );

    expect(records).toEqual([
      { id: 1, path: upperKey },
      { id: 2, path: lowerKey },
    ]);
  });

  it('keeps the previous output when temporary artifact validation fails', async () => {
    const testDirectory = await fs.mkdtemp(
      path.join(os.tmpdir(), 'onekey-dev-vendor-'),
    );
    const outputDirectory = path.join(testDirectory, 'output');
    const temporaryDirectory = path.join(testDirectory, 'temporary');
    await fs.ensureDir(outputDirectory);
    await fs.ensureDir(temporaryDirectory);
    await fs.writeFile(path.join(outputDirectory, 'marker'), 'previous');
    await fs.writeFile(path.join(temporaryDirectory, 'marker'), 'invalid');

    try {
      await expect(
        verifyAndReplaceDirectory({
          outputDirectory,
          temporaryDirectory,
          verifyTemporaryDirectory: () => {
            throw new TypeError('invalid manifest');
          },
        }),
      ).rejects.toThrow('invalid manifest');
      await expect(
        fs.readFile(path.join(outputDirectory, 'marker'), 'utf8'),
      ).resolves.toBe('previous');
      await expect(fs.pathExists(temporaryDirectory)).resolves.toBe(false);
    } finally {
      await fs.remove(testDirectory);
    }
  });

  it('keeps only equivalent static vendor modules with a closed sync graph', () => {
    const repoRoot = '/repo';
    const aPath = '/repo/node_modules/a.js';
    const bPath = '/repo/node_modules/b.js';
    const cPath = '/repo/node_modules/c.js';
    const dPath = '/repo/node_modules/d.js';
    const ePath = '/repo/node_modules/e.js';
    const appPath = '/repo/apps/mobile/app.js';
    const modules = new Map([
      [aPath, createModule('a', [{ path: bPath }])],
      [bPath, createModule('b')],
      [cPath, createModule('c', [{ path: appPath }])],
      [dPath, createModule('d', [{ asyncType: 'async', path: bPath }])],
      [ePath, createModule('main-e')],
      [appPath, createModule('app')],
    ]);
    const backgroundSignatures = new Map(
      [...modules].map(([absolutePath, moduleData]) => [
        absolutePath,
        buildModuleSignature(moduleData),
      ]),
    );
    backgroundSignatures.set(ePath, buildModuleSignature(createModule('bg-e')));

    const selected = selectClosedVendorModules({
      backgroundSignatures,
      mainGraph: { dependencies: modules },
      repoRoot,
    });

    expect([...selected].toSorted()).toEqual([aPath, bPath]);
  });

  it('iteratively removes parents when a dependency leaves the closed set', () => {
    const repoRoot = '/repo';
    const parentPath = '/repo/node_modules/parent.js';
    const childPath = '/repo/node_modules/child.js';
    const appPath = '/repo/apps/mobile/app.js';
    const modules = new Map([
      [parentPath, createModule('parent', [{ path: childPath }])],
      [childPath, createModule('child', [{ path: appPath }])],
      [appPath, createModule('app')],
    ]);
    const backgroundSignatures = new Map(
      [...modules].map(([absolutePath, moduleData]) => [
        absolutePath,
        buildModuleSignature(moduleData),
      ]),
    );

    expect(
      selectClosedVendorModules({
        backgroundSignatures,
        mainGraph: { dependencies: modules },
        repoRoot,
      }).size,
    ).toBe(0);
  });
});
