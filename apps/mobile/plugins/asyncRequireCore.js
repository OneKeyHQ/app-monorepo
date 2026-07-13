/**
 * Pure logic for the split-bundle async-require wrapper, extracted so
 * it can be unit-tested without Metro's placeholder imports
 * (`__CHUNK_MODULE_ID_TO_HASH_MAP__`, etc.) that only resolve at bundle
 * time.  The template file `asyncRequireTpl.js` supplies the real deps.
 */

/**
 * @typedef {Object} WrappedAsyncRequireDeps
 * @property {Record<string | number, unknown>} chunkModuleIdToHashMap
 * @property {(chunkId: string | number) => Promise<void>} requireEnsure
 * @property {(moduleId: string | number, paths: string[]) => Promise<unknown>} asyncRequire
 */

/**
 * Build the wrapAsyncRequire function used as Metro's asyncRequireModulePath.
 *
 * Contract:
 *   - If the module has no entry in `chunkModuleIdToHashMap` → it is eager
 *     (already installed in the main/common bundle). Yield one microtask
 *     and delegate to Metro's asyncRequire; the installProdBundleLoader
 *     eager-fallback path then short-circuits the __loadBundleAsync call
 *     gracefully. Converting the wait to a fully synchronous `require`
 *     is NOT safe: async-compiled generators around `await import(...)`
 *     assume asynchronous resolution for circular-dependency breakage,
 *     so a sync short-circuit drops the runtime into deep recursion and
 *     Hermes crashes its GCScope handle stack.
 *   - If the entry is an array of chunk ids → ensure each, then delegate.
 *   - Otherwise → ensure the module's chunk, then delegate.
 *
 * @param {WrappedAsyncRequireDeps} deps
 */
function createWrappedAsyncRequire(deps) {
  const { chunkModuleIdToHashMap, requireEnsure, asyncRequire } = deps;
  return async function wrappedAsyncRequire(moduleId, paths) {
    const chunkEntry = chunkModuleIdToHashMap[moduleId];
    if (!chunkEntry) {
      await Promise.resolve();
    } else if (Array.isArray(chunkEntry)) {
      await Promise.all(chunkEntry.map((v) => requireEnsure(v)));
    } else {
      await requireEnsure(moduleId);
    }
    return asyncRequire(moduleId, paths);
  };
}

module.exports = { createWrappedAsyncRequire };
