const {
  ALLOCATION_VERSION,
  MODULE_ID_RANGES,
  REGISTRY_EPOCH,
  SCHEMA_VERSION,
} = require('../../plugins/moduleIdRegistry');
const {
  checkModuleMaps,
  collectModuleMapEntries,
  createEmptyRegistry,
  reconcileRegistries,
  updateRegistry,
  updateRegistryFromModulePaths,
} = require('../module-id-registry');

function createRegistry({ modules = {}, tombstones = {} } = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    registryEpoch: REGISTRY_EPOCH,
    allocationVersion: ALLOCATION_VERSION,
    ranges: MODULE_ID_RANGES,
    modules,
    tombstones,
  };
}

describe('module ID registry CLI helpers', () => {
  it('collects eager, main, background, common, and segment modules', () => {
    const entries = collectModuleMapEntries({
      common: { 1: 'packages/common.ts' },
      main: { 2: 'apps/mobile/main.ts' },
      background: { 3: 'apps/mobile/background.ts' },
      eager: { 5: 'packages/eager.ts' },
      segments: {
        'seg:test': {
          id: 1,
          runtime: 'main',
          modules: { 4: 'packages/segment.ts' },
        },
      },
    });

    expect(entries.map(({ moduleKey }) => moduleKey)).toEqual([
      'packages/common.ts',
      'apps/mobile/main.ts',
      'apps/mobile/background.ts',
      'packages/eager.ts',
      'packages/segment.ts',
    ]);
  });

  it('seeds IDs deterministically from the sorted union of input maps', () => {
    const first = updateRegistry(createEmptyRegistry(), [
      { main: { 90: 'packages/z.ts', 2: 'packages/a.ts' } },
      {
        background: { 8: 'packages/m.ts' },
        segments: {
          'seg:test': { modules: { 5: 'packages/a.ts' } },
        },
      },
    ]);
    const second = updateRegistry(createEmptyRegistry(), [
      { background: { 1: 'packages/m.ts' } },
      { main: { 1: 'packages/a.ts', 2: 'packages/z.ts' } },
    ]);

    expect(first.registry.modules).toEqual({
      'packages/a.ts': 1,
      'packages/m.ts': 2,
      'packages/z.ts': 3,
    });
    expect(second.registry.modules).toEqual(first.registry.modules);
  });

  it('seeds each module domain from its configured range', () => {
    const result = updateRegistry(createEmptyRegistry(), [
      {
        main: {
          1: 'packages/a.ts',
          2: 'node_modules/react/index.js',
          3: '__prelude__',
        },
      },
    ]);

    expect(result.registry.modules).toEqual({
      __prelude__: MODULE_ID_RANGES.virtual.start,
      'node_modules/react/index.js': MODULE_ID_RANGES.nodeModules.start,
      'packages/a.ts': MODULE_ID_RANGES.workspace.start,
    });
  });

  it('appends sorted new paths without changing old IDs or reusing tombstones', () => {
    const initial = createRegistry({
      modules: { 'packages/a.ts': 2 },
      tombstones: { 'packages/removed.ts': 7 },
    });
    const result = updateRegistry(initial, [
      {
        common: {
          100: 'packages/z.ts',
          101: 'packages/a.ts',
          102: 'packages/b.ts',
        },
      },
    ]);

    expect(result.registry.modules).toEqual({
      'packages/a.ts': 2,
      'packages/b.ts': 8,
      'packages/z.ts': 9,
    });
    expect(result.registry.tombstones).toEqual({
      'packages/removed.ts': 7,
    });
    expect(result.added).toBe(2);
  });

  it('appends graph paths deterministically without changing existing IDs', () => {
    const initial = createRegistry({
      modules: {
        'node_modules/react/index.js': MODULE_ID_RANGES.nodeModules.start,
      },
    });
    const result = updateRegistryFromModulePaths(
      initial,
      [
        '/repo/node_modules/z/index.js',
        '/repo/node_modules/react/cjs/react.development.js',
        '/repo/node_modules/a/index.js',
        '/repo/node_modules/react/index.js',
      ],
      '/repo',
    );

    expect(result.registry.modules).toEqual({
      'node_modules/a/index.js': MODULE_ID_RANGES.nodeModules.start + 1,
      'node_modules/react/cjs/react.development.js':
        MODULE_ID_RANGES.nodeModules.start + 2,
      'node_modules/react/index.js': MODULE_ID_RANGES.nodeModules.start,
      'node_modules/z/index.js': MODULE_ID_RANGES.nodeModules.start + 3,
    });
    expect(result.added).toBe(3);
  });

  it('does not automatically reactivate a tombstoned path', () => {
    expect(() =>
      updateRegistry(
        createRegistry({ tombstones: { 'packages/removed.ts': 7 } }),
        [{ main: { 1: 'packages/removed.ts' } }],
      ),
    ).toThrow('must be reviewed explicitly');
  });

  it('fails instead of spilling an exhausted domain into another range', () => {
    const registry = createRegistry({
      modules: { 'packages/a.ts': MODULE_ID_RANGES.workspace.end },
    });

    expect(() =>
      updateRegistry(registry, [{ main: { 1: 'packages/b.ts' } }]),
    ).toThrow('Module ID range exhausted for workspace');
  });

  it('checks build map registration and ID consistency', () => {
    const registry = createRegistry({
      modules: { 'packages/a.ts': 1, 'packages/b.ts': 2 },
    });
    expect(
      checkModuleMaps(registry, [
        {
          mapPath: 'valid.json',
          moduleMap: {
            main: { 1: 'packages/a.ts' },
            segments: { test: { modules: { 2: 'packages/b.ts' } } },
          },
        },
      ]),
    ).toEqual([]);

    const errors = checkModuleMaps(registry, [
      {
        mapPath: 'invalid.json',
        moduleMap: {
          main: { 9: 'packages/a.ts', 3: 'packages/missing.ts' },
        },
      },
    ]);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('ID mismatch for packages/a.ts'),
        expect.stringContaining('is not registered: packages/missing.ts'),
      ]),
    );
  });

  it('reassigns only colliding new paths after the maximum retained ID', () => {
    const base = createRegistry({
      modules: { 'packages/a.ts': 1 },
      tombstones: { 'packages/removed.ts': 2 },
    });
    const current = createRegistry({
      modules: {
        'packages/a.ts': 1,
        'packages/b.ts': 1,
        'packages/c.ts': 4,
      },
      tombstones: { 'packages/removed.ts': 2 },
    });
    const result = reconcileRegistries(base, current);

    expect(result.registry.modules).toEqual({
      'packages/a.ts': 1,
      'packages/b.ts': 5,
      'packages/c.ts': 4,
    });
    expect(result.registry.tombstones).toEqual(base.tombstones);
    expect(result.reassigned).toBe(1);
  });

  it('rejects changes to IDs and states inherited from the base registry', () => {
    const base = createRegistry({
      modules: { 'packages/a.ts': 1 },
      tombstones: { 'packages/removed.ts': 2 },
    });

    expect(() =>
      reconcileRegistries(
        base,
        createRegistry({
          modules: { 'packages/a.ts': 3 },
          tombstones: { 'packages/removed.ts': 2 },
        }),
      ),
    ).toThrow('Base modules entry changed or was removed');
    expect(() =>
      reconcileRegistries(
        base,
        createRegistry({
          modules: {
            'packages/a.ts': 1,
            'packages/removed.ts': 2,
          },
        }),
      ),
    ).toThrow('Base tombstones entry changed state');
  });
});
