/**
 * Web/desktop cold-start cache storage loader.
 *
 * Kept in its own module so native bundles resolve the sibling
 * `nonNativeColdStartStorage.native.ts` stub instead: Metro statically
 * collects `require()` calls, and routing this through a platform file keeps
 * `webColdStartStorage` and its IndexedDB stack out of native startup graphs.
 */
import type { ISyncStorage } from './createMMKVSyncStorage';

export function createNonNativeColdStartCacheStorage(): ISyncStorage {
  // Lazy require keeps module-load side effects (flush timers, IDB warmup)
  // deferred until the storage is actually constructed.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createWebColdStartStorage } =
    require('./webColdStartStorage') as typeof import('./webColdStartStorage');
  return createWebColdStartStorage();
}
