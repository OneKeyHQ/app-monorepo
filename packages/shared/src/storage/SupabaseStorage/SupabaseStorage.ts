import platformEnv from '../../platformEnv';
import cacheUtils from '../../utils/cacheUtils';
import timerUtils from '../../utils/timerUtils';
import appStorage from '../appStorage';
import secureStorageInstance from '../instance/secureStorageInstance';

import { SUPABASE_STORAGE_KEY_PREFIX } from './consts';

const shouldUseSecureStorage = platformEnv.isNative || platformEnv.isDesktop;

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
    (key: string) => {
      // eslint-disable-next-line no-param-reassign
      key = withPrefixedKey(key);

      if (shouldUseSecureStorage) {
        return secureStorageInstance.getSecureItem(key);
      }
      return appStorage.getItem(key);
    },
    {
      promise: true,
      primitive: true,
      maxAge: timerUtils.getTimeDurationMs({ seconds: 10 }),
    },
  );

  async setItem(key: string, value: string) {
    // eslint-disable-next-line no-param-reassign
    key = withPrefixedKey(key);
    this.getItemWithCache.clear();

    if (shouldUseSecureStorage) {
      return secureStorageInstance.setSecureItem(key, value);
    }
    return appStorage.setItem(key, value);
  }

  async removeItem(key: string) {
    // eslint-disable-next-line no-param-reassign
    key = withPrefixedKey(key);
    this.getItemWithCache.clear();

    if (shouldUseSecureStorage) {
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

    await Promise.all(
      keysToRemove.map((k) => {
        if (shouldUseSecureStorage) {
          return secureStorageInstance.removeSecureItem(k);
        }
        return appStorage.removeItem(k);
      }),
    );

    prefixedKeys.clear();
  }
}
