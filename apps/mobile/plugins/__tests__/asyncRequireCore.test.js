/**
 * Unit tests for the split-bundle async-require wrapper.
 *
 * Contract: for eager modules (no chunk-map entry) we must still yield a
 * microtask and delegate to Metro's asyncRequire.  Converting this path
 * to a fully synchronous require breaks async/await generators around
 * `await import(...)` — the Hermes GC handle stack grows without bound
 * under circular dynamic imports and crashes in `GCScope::_newChunkAndPHV`.
 * The `installProdBundleLoader` eager-fallback path is responsible for
 * short-circuiting the `__loadBundleAsync` call gracefully.
 */

const { createWrappedAsyncRequire } = require('../asyncRequireCore');

function makeDeps({ chunkModuleIdToHashMap = {} } = {}) {
  const asyncRequire = jest.fn(async (id) => ({ asyncModule: id }));
  const requireEnsure = jest.fn().mockResolvedValue(undefined);
  return {
    chunkModuleIdToHashMap,
    asyncRequire,
    requireEnsure,
  };
}

describe('asyncRequireCore.createWrappedAsyncRequire', () => {
  it('delegates to Metro asyncRequire after a microtask for eager modules', async () => {
    const deps = makeDeps();
    const wrapped = createWrappedAsyncRequire(deps);

    const result = await wrapped(42, ['/pkg/foo']);

    expect(deps.asyncRequire).toHaveBeenCalledWith(42, ['/pkg/foo']);
    expect(deps.requireEnsure).not.toHaveBeenCalled();
    expect(result).toEqual({ asyncModule: 42 });
  });

  it('goes through requireEnsure + asyncRequire for a split chunk entry', async () => {
    const deps = makeDeps({
      chunkModuleIdToHashMap: { 100: { hash: 'deadbeef' } },
    });
    const wrapped = createWrappedAsyncRequire(deps);

    const result = await wrapped(100, ['/path']);

    expect(deps.requireEnsure).toHaveBeenCalledWith(100);
    expect(deps.asyncRequire).toHaveBeenCalledWith(100, ['/path']);
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

  it('preserves async semantics by yielding a microtask on the eager path', async () => {
    // Regression guard against the Hermes GCScope crash we saw when the
    // eager path was switched to a fully synchronous require.  Modules
    // whose factories do `await import(...)` in a circular graph rely on
    // the microtask yield to unwind; collapsing that into a sync call
    // sent the runtime into unbounded generator recursion.
    const order = [];
    const deps = makeDeps();
    deps.asyncRequire = jest.fn(async (id) => {
      order.push('asyncRequire');
      return { asyncModule: id };
    });
    const wrapped = createWrappedAsyncRequire(deps);

    const promise = wrapped(1, []);
    // asyncRequire must NOT have been called synchronously before the
    // promise gets a chance to suspend.
    expect(order).toEqual([]);
    await promise;
    expect(order).toEqual(['asyncRequire']);
  });
});
