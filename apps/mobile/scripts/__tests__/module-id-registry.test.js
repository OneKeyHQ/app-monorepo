const {
  ALLOCATION_VERSION,
  MODULE_ID_RANGES,
  REGISTRY_EPOCH,
  SCHEMA_VERSION,
  createModuleIdAllocator,
  isModuleIdInDomain,
} = require('../../plugins/moduleIdRegistry');
const {
  checkModuleMaps,
  collectModuleMapEntries,
  createEmptyRegistry,
  parseArgs,
  reallocateRegistry,
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

    expect(second.registry.modules).toEqual(first.registry.modules);
    expect(Object.keys(first.registry.modules)).toEqual([
      'packages/a.ts',
      'packages/m.ts',
      'packages/z.ts',
    ]);
    expect(new Set(Object.values(first.registry.modules)).size).toBe(3);
    expect(
      Object.values(first.registry.modules).every((moduleId) =>
        isModuleIdInDomain(moduleId, 'workspace'),
      ),
    ).toBe(true);
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

    expect(
      isModuleIdInDomain(result.registry.modules.__prelude__, 'virtual'),
    ).toBe(true);
    expect(
      isModuleIdInDomain(
        result.registry.modules['node_modules/react/index.js'],
        'nodeModules',
      ),
    ).toBe(true);
    expect(
      isModuleIdInDomain(result.registry.modules['packages/a.ts'], 'workspace'),
    ).toBe(true);
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

    expect(result.registry.modules['packages/a.ts']).toBe(2);
    expect(Object.keys(result.registry.modules)).toEqual([
      'packages/a.ts',
      'packages/b.ts',
      'packages/z.ts',
    ]);
    expect(new Set(Object.values(result.registry.modules)).size).toBe(3);
    expect(Object.values(result.registry.modules)).not.toContain(7);
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

    expect(result.registry.modules['node_modules/react/index.js']).toBe(
      MODULE_ID_RANGES.nodeModules.start,
    );
    expect(Object.keys(result.registry.modules)).toEqual([
      'node_modules/a/index.js',
      'node_modules/react/cjs/react.development.js',
      'node_modules/react/index.js',
      'node_modules/z/index.js',
    ]);
    expect(new Set(Object.values(result.registry.modules)).size).toBe(4);
    expect(
      Object.values(result.registry.modules).every((moduleId) =>
        isModuleIdInDomain(moduleId, 'nodeModules'),
      ),
    ).toBe(true);
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
    const { start, end } = MODULE_ID_RANGES.workspace;
    const allocateModuleId = createModuleIdAllocator(
      Array.from({ length: end - start + 1 }, (_, index) => start + index),
    );

    expect(() => allocateModuleId('workspace', 'packages/b.ts')).toThrow(
      'Module ID range exhausted for workspace',
    );
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

  it('reassigns only colliding new paths with the path-based allocator', () => {
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

    expect(result.registry.modules['packages/a.ts']).toBe(1);
    expect(result.registry.modules['packages/c.ts']).toBe(4);
    expect(
      isModuleIdInDomain(result.registry.modules['packages/b.ts'], 'workspace'),
    ).toBe(true);
    expect([1, 2, 4]).not.toContain(result.registry.modules['packages/b.ts']);
    expect(result.registry.tombstones).toEqual(base.tombstones);
    expect(result.reassigned).toBe(1);
  });

  it('reassigns new IDs outside their module domains', () => {
    const base = createRegistry({
      modules: { 'packages/a.ts': 1 },
    });
    const current = createRegistry({
      modules: {
        'node_modules/react/index.js': 2,
        'packages/a.ts': 1,
        'packages/b.ts': MODULE_ID_RANGES.nodeModules.start,
      },
    });
    const result = reconcileRegistries(base, current);

    expect(result.registry.modules['packages/a.ts']).toBe(1);
    expect(
      isModuleIdInDomain(
        result.registry.modules['node_modules/react/index.js'],
        'nodeModules',
      ),
    ).toBe(true);
    expect(
      isModuleIdInDomain(result.registry.modules['packages/b.ts'], 'workspace'),
    ).toBe(true);
    expect(new Set(Object.values(result.registry.modules)).size).toBe(3);
    expect(result.reassigned).toBe(2);
  });

  it('fully reallocates active and tombstoned paths with the new epoch', () => {
    const result = reallocateRegistry(
      createRegistry({
        modules: {
          'node_modules/react/index.js': 2,
          'packages/a.ts': 1,
          'packages/b.ts': 1,
        },
        tombstones: { 'packages/removed.ts': 2 },
      }),
    );

    expect(result.registryEpoch).toBe(REGISTRY_EPOCH);
    expect(result.allocationVersion).toBe(ALLOCATION_VERSION);
    expect(Object.keys(result.modules)).toEqual([
      'node_modules/react/index.js',
      'packages/a.ts',
      'packages/b.ts',
    ]);
    expect(Object.keys(result.tombstones)).toEqual(['packages/removed.ts']);
    expect(
      new Set([
        ...Object.values(result.modules),
        ...Object.values(result.tombstones),
      ]).size,
    ).toBe(4);
    expect(
      isModuleIdInDomain(
        result.modules['node_modules/react/index.js'],
        'nodeModules',
      ),
    ).toBe(true);
  });

  it('accepts the collision-resolution command without an explicit base', () => {
    expect(parseArgs(['resolve-collisions'])).toEqual({
      base: undefined,
      command: 'resolve-collisions',
      mapPaths: [],
    });
    expect(parseArgs(['resolve-collisions', '--base', 'origin/x']).base).toBe(
      'origin/x',
    );
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
