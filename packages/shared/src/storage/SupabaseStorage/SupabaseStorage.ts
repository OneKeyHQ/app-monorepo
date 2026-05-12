import { EAppEventBusNames, appEventBus } from '../../eventBus/appEventBus';
import platformEnv from '../../platformEnv';
import cacheUtils from '../../utils/cacheUtils';
import timerUtils from '../../utils/timerUtils';
import appStorage from '../appStorage';
import secureStorageInstance from '../instance/secureStorageInstance';

import { SUPABASE_STORAGE_KEY_PREFIX } from './consts';

const shouldUseSecureStorage = cacheUtils.memoizee(
  async () => {
    const isSupportSecureStorage =
      await secureStorageInstance.supportSecureStorageWithoutInteraction();
    if (!isSupportSecureStorage) {
      return false;
    }
    if (platformEnv.isNative) {
      return true;
    }
    // The secure storage of the desktop in the development environment does not work, the data written only has the key, and the value is always empty
    if (platformEnv.isDesktop && !platformEnv.isDev) {
      return true;
    }
    return false;
  },
  { promise: true, primitive: true },
);

const prefixedKeys = new Set<string>();

const withPrefixedKey = (key: string) => {
  const newKey = `${SUPABASE_STORAGE_KEY_PREFIX as string}${key}`;
  prefixedKeys.add(newKey);
  return newKey;
};

const buildCacheSourceId = () =>
  `supabase-storage-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export class SupabaseStorage {
  constructor() {
    appEventBus.on(
      EAppEventBusNames.SupabaseStorageCacheCleared,
      ({ sourceId }) => {
        if (sourceId === this.cacheSourceId) {
          return;
        }
        this.clearLocalCache();
      },
    );
  }

  private readonly cacheSourceId = buildCacheSourceId();

  private readonly getItemWithCache = cacheUtils.memoizee(
    async (key: string) => {
      // eslint-disable-next-line no-param-reassign
      key = withPrefixedKey(key);

      if (await shouldUseSecureStorage()) {
        return (await secureStorageInstance.getSecureItem(key)) ?? null;
      }
      return (await appStorage.getItem(key)) ?? null;
    },
    {
      promise: true,
      primitive: true,
      maxAge: timerUtils.getTimeDurationMs({ seconds: 30 }),
    },
  );

  private clearLocalCache() {
    this.getItemWithCache.clear();
  }

  clearCache({ syncRemote = true }: { syncRemote?: boolean } = {}) {
    this.clearLocalCache();
    if (!syncRemote) {
      return;
    }
    appEventBus.emit(EAppEventBusNames.SupabaseStorageCacheCleared, {
      sourceId: this.cacheSourceId,
    });
  }

  async getItem(key: string): Promise<string | null> {
    return this.getItemWithCache(key);
  }

  async setItem(key: string, value: string) {
    // eslint-disable-next-line no-param-reassign
    key = withPrefixedKey(key);
    this.clearCache({ syncRemote: false });

    if (await shouldUseSecureStorage()) {
      const result = await secureStorageInstance.setSecureItem(key, value);
      this.clearCache();
      return result;
    }
    const result = await appStorage.setItem(key, value);
    this.clearCache();
    return result;
  }

  async removeItem(key: string) {
    // eslint-disable-next-line no-param-reassign
    key = withPrefixedKey(key);
    this.clearCache({ syncRemote: false });

    if (await shouldUseSecureStorage()) {
      const result = await secureStorageInstance.removeSecureItem(key);
      this.clearCache();
      return result;
    }
    const result = await appStorage.removeItem(key);
    this.clearCache();
    return result;
  }

  async getAllKeys() {
    return Array.from(prefixedKeys);
  }

  async clear() {
    const keysToRemove = await this.getAllKeys();

    if (!keysToRemove.length) {
      this.clearCache();
      return;
    }
    const _shouldUseSecureStorage = await shouldUseSecureStorage();

    await Promise.all(
      keysToRemove.map((k) => {
        if (_shouldUseSecureStorage) {
          return secureStorageInstance.removeSecureItem(k);
        }
        return appStorage.removeItem(k);
      }),
    );

    prefixedKeys.clear();
    this.clearCache();
  }
}
