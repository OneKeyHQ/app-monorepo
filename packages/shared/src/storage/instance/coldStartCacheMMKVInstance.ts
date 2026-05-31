import { createMMKV } from 'react-native-mmkv';

import platformEnv from '../../platformEnv';

import {
  COLD_START_CACHE_STORAGE_ENCRYPTION_KEY,
  COLD_START_CACHE_STORAGE_ID,
  LEGACY_COLD_START_CACHE_STORAGE_ID,
} from './coldStartCacheStorageConfig';

const coldStartCacheMMKVInstance = createMMKV(
  platformEnv.isNative
    ? {
        id: COLD_START_CACHE_STORAGE_ID,
        encryptionKey: COLD_START_CACHE_STORAGE_ENCRYPTION_KEY,
      }
    : {
        id: COLD_START_CACHE_STORAGE_ID,
      },
);
export default coldStartCacheMMKVInstance;

let legacyColdStartCacheMMKVInstance: ReturnType<typeof createMMKV> | undefined;

export function getLegacyColdStartCacheMMKVInstance() {
  legacyColdStartCacheMMKVInstance ??= createMMKV({
    id: LEGACY_COLD_START_CACHE_STORAGE_ID,
  });
  return legacyColdStartCacheMMKVInstance;
}
