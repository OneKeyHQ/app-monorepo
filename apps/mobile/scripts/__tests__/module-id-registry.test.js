const {
  checkModuleMaps,
  collectModuleMapEntries,
  createEmptyRegistry,
  reconcileRegistries,
  updateRegistry,
} = require('../module-id-registry');

function createRegistry({ modules = {}, tombstones = {} } = {}) {
  return {
    schemaVersion: 1,
    registryEpoch: 1,
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

  it('does not automatically reactivate a tombstoned path', () => {
    expect(() =>
      updateRegistry(
        createRegistry({ tombstones: { 'packages/removed.ts': 7 } }),
        [{ main: { 1: 'packages/removed.ts' } }],
      ),
    ).toThrow('must be reviewed explicitly');
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
