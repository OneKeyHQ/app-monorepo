/**
 * Native stub for the web/desktop cold-start cache storage loader.
 *
 * Native runtimes build their cold-start storage in
 * `nativeSyncStorageParts.native.ts`; this stub keeps `webColdStartStorage`
 * and its IndexedDB stack out of native startup graphs.
 */
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { ISyncStorage } from './createMMKVSyncStorage';

export function createNonNativeColdStartCacheStorage(): ISyncStorage {
  throw new OneKeyLocalError(
    'createNonNativeColdStartCacheStorage is not available on native runtimes',
  );
}
