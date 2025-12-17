import platformEnv from '../../platformEnv';
import cacheUtils from '../../utils/cacheUtils';
import timerUtils from '../../utils/timerUtils';
import appStorage from '../appStorage';
import secureStorageInstance from '../instance/secureStorageInstance';

import { SUPABASE_STORAGE_KEY_PREFIX } from './consts';

const shouldUseSecureStorage = cacheUtils.memoizee(
  async () => {
    const isSupportSecureStorage =
      await secureStorageInstance.supportSecureStorage();
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

export class SupabaseStorage {
  async getItem(key: string) {
    return this.getItemWithCache(key);
  }

  getItemWithCache = cacheUtils.memoizee(
    async (key: string) => {
      // eslint-disable-next-line no-param-reassign
      key = withPrefixedKey(key);

      if (await shouldUseSecureStorage()) {
        const result = await secureStorageInstance.getSecureItem(key);
        return result;
      }
      const result = await appStorage.getItem(key);
      return result;
    },
    {
      promise: true,
      primitive: true,
      maxAge: timerUtils.getTimeDurationMs({ seconds: 30 }),
    },
  );

  async setItem(key: string, value: string) {
    // eslint-disable-next-line no-param-reassign
    key = withPrefixedKey(key);
    this.getItemWithCache.clear();

    if (await shouldUseSecureStorage()) {
      return secureStorageInstance.setSecureItem(key, value);
    }
    return appStorage.setItem(key, value);
  }

  async removeItem(key: string) {
    // eslint-disable-next-line no-param-reassign
    key = withPrefixedKey(key);
    this.getItemWithCache.clear();

    if (await shouldUseSecureStorage()) {
      return secureStorageInstance.removeSecureItem(key);
    }
    return appStorage.removeItem(key);
  }

  async getAllKeys() {
    return Array.from(prefixedKeys);
  }

  async clear() {
    const keysToRemove = await this.getAllKeys();
    this.getItemWithCache.clear();

    if (!keysToRemove.length) {
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
  }
}
