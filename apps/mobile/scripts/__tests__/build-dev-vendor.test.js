const {
  addObservedModulePaths,
  normalizeFullSourceMapsForBundle,
  parseArgs,
  selectClosedVendorModules,
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
      registryUpdate: false,
    });
    expect(parseArgs(['--platform', 'android', '--update-registry'])).toEqual({
      check: false,
      platforms: ['android'],
      registryUpdate: true,
    });
    expect(() => parseArgs(['--platform', 'web'])).toThrow(
      '--platform must be android, ios, or all',
    );
    expect(() => parseArgs(['--check', '--update-registry'])).toThrow(
      '--check and --update-registry cannot be used together',
    );
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

  it('clones every full-map JS module without changing code or graph data', () => {
    const firstFullMap = { mappings: 'AAAA', version: 3 };
    const secondFullMap = { mappings: 'BBBB', version: 3 };
    const rawMap = [[1, 0, 1, 0]];
    const first = createModule('first\nsecond');
    first.path = '/repo/first.js';
    first.output[0].data.lineCount = 2;
    first.output[0].data.map = firstFullMap;
    const second = createModule('second');
    second.path = '/repo/second.js';
    second.output[0].data.lineCount = 1;
    second.output[0].data.map = rawMap;
    const third = createModule('third');
    third.path = '/repo/third.js';
    third.output[0].data.lineCount = 1;
    third.output[0].data.map = secondFullMap;
    const originalModules = [first, second, third];

    const normalized = normalizeFullSourceMapsForBundle(originalModules);

    expect(normalized.fullMapModulePaths).toEqual([
      '/repo/first.js',
      '/repo/third.js',
    ]);
    expect(normalized.modules[0]).not.toBe(first);
    expect(normalized.modules[0].output[0]).not.toBe(first.output[0]);
    expect(normalized.modules[0].output[0].data).toMatchObject({
      code: 'first\nsecond',
      lineCount: 2,
      map: null,
    });
    expect(normalized.modules[1]).toBe(second);
    expect(normalized.modules[1].output[0].data.map).toBe(rawMap);
    expect(first.output[0].data.map).toBe(firstFullMap);
    expect(third.output[0].data.map).toBe(secondFullMap);
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
