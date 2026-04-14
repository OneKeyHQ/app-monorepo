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
 * @property {(moduleId: string | number) => unknown} syncRequire
 */

/**
 * Build the wrapAsyncRequire function used as Metro's asyncRequireModulePath.
 *
 * Contract:
 *   - If the module has no entry in `chunkModuleIdToHashMap` → it is eager
 *     (already installed in the main/common bundle). Skip Metro's
 *     asyncRequire (which would call __loadBundleAsync with a URL-style
 *     key the segment manifest has no entry for) and return the
 *     synchronous require result directly.
 *   - If the entry is an array of chunk ids → ensure each, then delegate
 *     to Metro's asyncRequire for the final module resolution.
 *   - Otherwise → ensure the module's chunk, then delegate.
 *
 * @param {WrappedAsyncRequireDeps} deps
 */
function createWrappedAsyncRequire(deps) {
  const {
    chunkModuleIdToHashMap,
    requireEnsure,
    asyncRequire,
    syncRequire,
  } = deps;
  return async function wrappedAsyncRequire(moduleId, paths) {
    const chunkEntry = chunkModuleIdToHashMap[moduleId];
    if (!chunkEntry) {
      return syncRequire(moduleId);
    }
    if (Array.isArray(chunkEntry)) {
      await Promise.all(chunkEntry.map((v) => requireEnsure(v)));
    } else {
      await requireEnsure(moduleId);
    }
    return asyncRequire(moduleId, paths);
  };
}

module.exports = { createWrappedAsyncRequire };
