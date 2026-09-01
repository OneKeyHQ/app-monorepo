const path = require('path');

const {
  ALLOCATION_VERSION,
  MODULE_ID_RANGES,
  REGISTRY_EPOCH,
  SCHEMA_VERSION,
  collectRegistryErrors,
  createFileToIdMap,
  getModuleIdDomain,
  isStrictRegistryMode,
  loadRegistry,
  toModuleKey,
} = require('../moduleIdRegistry');

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

describe('moduleIdRegistry', () => {
  it('normalizes the same relative source path across worktrees', () => {
    const firstRoot = path.resolve('/tmp/worktree-a');
    const secondRoot = path.resolve('/Volumes/build/worktree-b');
    const relativePath = 'packages/shared/src/utils/test.ts';

    expect(toModuleKey(path.join(firstRoot, relativePath), firstRoot)).toBe(
      relativePath,
    );
    expect(toModuleKey(path.join(secondRoot, relativePath), secondRoot)).toBe(
      relativePath,
    );
    expect(() => toModuleKey('C:\\worktree\\packages\\a.ts')).toThrow(
      'drive path',
    );
  });

  it('reserves active and tombstone IDs for lenient ephemeral modules', () => {
    const repoRoot = path.resolve('/tmp/worktree');
    const fileMap = createFileToIdMap({
      registry: createRegistry({
        modules: { 'packages/a.ts': 1 },
        tombstones: { 'packages/removed.ts': 3 },
      }),
      repoRoot,
      strict: false,
    });

    expect(fileMap.entries()).toEqual(expect.anything());
    expect([...fileMap.entries()]).toEqual([]);
    expect(fileMap.get(path.join(repoRoot, 'packages/a.ts'))).toBe(1);
    expect(fileMap.get(path.join(repoRoot, 'packages/new.ts'))).toBe(4);
    expect(fileMap.delete(path.join(repoRoot, 'packages/new.ts'))).toBe(true);
    expect(fileMap.has(path.join(repoRoot, 'packages/new.ts'))).toBe(false);
    expect(fileMap.get(path.join(repoRoot, 'packages/new.ts'))).toBe(4);
    expect(fileMap.has(path.join(repoRoot, 'packages/new.ts'))).toBe(true);
    expect(fileMap.get(path.join(repoRoot, 'packages/newer.ts'))).toBe(5);
    expect([...fileMap.entries()]).toEqual([
      [path.join(repoRoot, 'packages/a.ts'), 1],
      [path.join(repoRoot, 'packages/new.ts'), 4],
      [path.join(repoRoot, 'packages/newer.ts'), 5],
    ]);
  });

  it('allows set to observe the matching ID of a registered path', () => {
    const repoRoot = path.resolve('/tmp/worktree');
    const registeredPath = path.join(repoRoot, 'packages/a.ts');
    const fileMap = createFileToIdMap({
      registry: createRegistry({ modules: { 'packages/a.ts': 7 } }),
      repoRoot,
      strict: false,
    });

    fileMap.set(registeredPath, 7);
    expect(fileMap.has(registeredPath)).toBe(true);
    expect([...fileMap.entries()]).toEqual([[registeredPath, 7]]);
    expect(() => fileMap.set(registeredPath, 8)).toThrow('must use ID 7');
    expect(() =>
      fileMap.set(path.join(repoRoot, 'packages/other.ts'), 7),
    ).toThrow('already reserved');
  });

  it('uses session-only IDs for unknown and external paths in lenient mode', () => {
    const repoRoot = path.resolve('/tmp/worktree');
    const fileMap = createFileToIdMap({
      registry: createRegistry(),
      repoRoot,
      strict: false,
    });
    const unknownPath = path.join(repoRoot, 'packages/new.ts');
    const externalPath = path.resolve('/tmp/external/module.js');

    expect(fileMap.get(unknownPath)).toBe(1);
    expect(fileMap.get(unknownPath)).toBe(1);
    expect(fileMap.get(externalPath)).toBe(2);
  });

  it('allocates lenient IDs inside independent module domains', () => {
    const repoRoot = path.resolve('/tmp/worktree');
    const fileMap = createFileToIdMap({
      registry: createRegistry(),
      repoRoot,
      strict: false,
    });

    expect(fileMap.get(path.join(repoRoot, 'packages/new.ts'))).toBe(1);
    expect(fileMap.get(path.join(repoRoot, 'node_modules/a/index.js'))).toBe(
      MODULE_ID_RANGES.nodeModules.start,
    );
    expect(fileMap.get('\0virtual:test')).toBe(MODULE_ID_RANGES.virtual.start);
  });

  it('rejects unknown and external paths in strict mode with an update hint', () => {
    const repoRoot = path.resolve('/tmp/worktree');
    const fileMap = createFileToIdMap({
      registry: createRegistry({ modules: { 'packages/a.ts': 7 } }),
      repoRoot,
      strict: true,
    });

    expect(fileMap.get(path.join(repoRoot, 'packages/a.ts'))).toBe(7);
    expect(() => fileMap.get(path.join(repoRoot, 'packages/new.ts'))).toThrow(
      'module-id:update',
    );
    expect(() => fileMap.get('/tmp/external/module.js')).toThrow(
      'outside the monorepo root',
    );
  });

  it('resolves the Expo native asset registry virtual module in strict mode', () => {
    const virtualModulePath = '\0polyfill:assets-registry';
    const registry = loadRegistry();
    const fileMap = createFileToIdMap({
      registry,
      strict: true,
    });

    expect(fileMap.get(virtualModulePath)).toBe(
      registry.modules[virtualModulePath],
    );
  });

  it('ignores unresolved dependency edges in strict mode', () => {
    const fileMap = createFileToIdMap({
      registry: createRegistry(),
      repoRoot: path.resolve('/tmp/worktree'),
      strict: true,
    });

    expect(fileMap.get(undefined)).toBeUndefined();
    expect(fileMap.get('')).toBeUndefined();
  });

  it('defaults union and production builds to strict with an explicit override', () => {
    expect(isStrictRegistryMode({ UNION_BUILD: 'true' })).toBe(true);
    expect(isStrictRegistryMode({ NODE_ENV: 'production' })).toBe(true);
    expect(
      isStrictRegistryMode({
        NODE_ENV: 'production',
        ONEKEY_MODULE_ID_REGISTRY_STRICT: 'false',
      }),
    ).toBe(false);
    expect(
      isStrictRegistryMode({ ONEKEY_MODULE_ID_REGISTRY_STRICT: 'true' }),
    ).toBe(true);
  });

  it('detects unsorted paths, duplicate IDs, and active tombstones', () => {
    const errors = collectRegistryErrors(
      createRegistry({
        modules: { 'packages/z.ts': 1, 'packages/a.ts': 2 },
        tombstones: { 'packages/a.ts': 1 },
      }),
    );

    expect(errors).toEqual(
      expect.arrayContaining([
        'modules keys must be sorted.',
        expect.stringContaining('Module ID 1 is assigned'),
        'Module key is both active and tombstoned: packages/a.ts.',
      ]),
    );
  });

  it('classifies module ownership and rejects IDs outside its range', () => {
    expect(getModuleIdDomain('packages/shared/index.ts')).toBe('workspace');
    expect(getModuleIdDomain('node_modules/react/index.js')).toBe(
      'nodeModules',
    );
    expect(
      getModuleIdDomain('packages/example/node_modules/react/index.js'),
    ).toBe('nodeModules');
    expect(getModuleIdDomain('__prelude__')).toBe('virtual');

    expect(
      collectRegistryErrors(
        createRegistry({
          modules: { 'node_modules/react/index.js': 1 },
        }),
      ),
    ).toEqual([expect.stringContaining('must be in the nodeModules range')]);
  });
});
