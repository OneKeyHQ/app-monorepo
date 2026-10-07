import type { IJotaiNativeStorageHydration } from './jotaiInitFromNativeStorageTypes';

/**
 * Non-native builds have one runtime, so there is no second copy of the Jotai
 * store to hydrate ahead of it. `jotaiInit` reads the same storage directly.
 */
export async function hydrateJotaiFromNativeStorage(): Promise<IJotaiNativeStorageHydration> {
  return Promise.resolve({
    hydrated: false,
    atomCount: 0,
    reason: 'not-native',
  });
}
