/**
 * Layer 1 unit tests: eager async imports must bypass Metro's asyncRequire
 * (and therefore __loadBundleAsync) entirely, and instead resolve
 * synchronously from the already-loaded module registry.
 */

const { createWrappedAsyncRequire } = require('../asyncRequireCore');

function makeDeps({ chunkModuleIdToHashMap = {} } = {}) {
  const asyncRequire = jest.fn(async (id) => ({ asyncModule: id }));
  const requireEnsure = jest.fn().mockResolvedValue(undefined);
  const syncRequire = jest.fn((id) => ({ syncModule: id }));
  return {
    chunkModuleIdToHashMap,
    asyncRequire,
    requireEnsure,
    syncRequire,
  };
}

describe('asyncRequireTpl.createWrappedAsyncRequire', () => {
  it('returns syncRequire(moduleId) for eager modules (no chunk entry)', async () => {
    const deps = makeDeps();
    const wrapped = createWrappedAsyncRequire(deps);

    const result = await wrapped(42, ['/some/path']);

    expect(result).toEqual({ syncModule: 42 });
    expect(deps.syncRequire).toHaveBeenCalledWith(42);
    expect(deps.asyncRequire).not.toHaveBeenCalled();
    expect(deps.requireEnsure).not.toHaveBeenCalled();
  });

  it('goes through requireEnsure + asyncRequire for a split chunk entry', async () => {
    const deps = makeDeps({
      chunkModuleIdToHashMap: { 100: { hash: 'deadbeef' } },
    });
    const wrapped = createWrappedAsyncRequire(deps);

    const result = await wrapped(100, ['/path']);

    expect(deps.requireEnsure).toHaveBeenCalledWith(100);
    expect(deps.asyncRequire).toHaveBeenCalledWith(100, ['/path']);
    expect(deps.syncRequire).not.toHaveBeenCalled();
    expect(result).toEqual({ asyncModule: 100 });
  });

  it('ensures every chunk listed in an array hashMap before asyncRequire', async () => {
    const deps = makeDeps({
      chunkModuleIdToHashMap: { 200: ['a', 'b', 'c'] },
    });
    const wrapped = createWrappedAsyncRequire(deps);

    await wrapped(200, ['/arr']);

    expect(deps.requireEnsure).toHaveBeenCalledWith('a');
    expect(deps.requireEnsure).toHaveBeenCalledWith('b');
    expect(deps.requireEnsure).toHaveBeenCalledWith('c');
    expect(deps.asyncRequire).toHaveBeenCalledTimes(1);
  });

  it('never calls __loadBundleAsync-backed asyncRequire for eager modules', async () => {
    // The real-world bug: btc/sdkBtc stayed in the eager bundle but
    // Metro's asyncRequire still hit __loadBundleAsync with a URL the
    // segment manifest has no entry for.  This test guards the shape of
    // that fix: chunk-map miss → synchronous require, period.
    const deps = makeDeps();
    const wrapped = createWrappedAsyncRequire(deps);
    await wrapped('@onekeyhq/core/src/chains/btc/sdkBtc', []);
    expect(deps.asyncRequire).not.toHaveBeenCalled();
  });

  it('propagates syncRequire errors', async () => {
    const deps = makeDeps();
    deps.syncRequire = jest.fn(() => {
      throw new Error('module not installed');
    });
    const wrapped = createWrappedAsyncRequire(deps);
    await expect(wrapped(1, [])).rejects.toThrow('module not installed');
  });
});
