import { createMMKV } from 'react-native-mmkv';

import platformEnv from '../../platformEnv';

import {
  COLD_START_CACHE_STORAGE_ID,
  LEGACY_COLD_START_CACHE_STORAGE_ID,
} from './coldStartCacheStorageConfig';
import { getColdStartCacheStorageEncryptionKey } from './coldStartCacheStorageEncryptionKey';

const coldStartCacheStorageEncryptionKey =
  getColdStartCacheStorageEncryptionKey();

export const isColdStartCacheStorageAvailable =
  !platformEnv.isNative || Boolean(coldStartCacheStorageEncryptionKey);

const coldStartCacheMMKVInstance = isColdStartCacheStorageAvailable
  ? createMMKV(
      platformEnv.isNative
        ? {
            id: COLD_START_CACHE_STORAGE_ID,
            encryptionKey: coldStartCacheStorageEncryptionKey as string,
          }
        : {
            id: COLD_START_CACHE_STORAGE_ID,
          },
    )
  : undefined;
export default coldStartCacheMMKVInstance;

let legacyColdStartCacheMMKVInstance: ReturnType<typeof createMMKV> | undefined;

export function getLegacyColdStartCacheMMKVInstance() {
  legacyColdStartCacheMMKVInstance ??= createMMKV({
    id: LEGACY_COLD_START_CACHE_STORAGE_ID,
  });
  return legacyColdStartCacheMMKVInstance;
}
