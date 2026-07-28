import platformEnv from '../../platformEnv';
import WebStorage, { EWebStorageKeyPrefix } from '../WebStorage';

import type { AsyncStorageStatic } from '@react-native-async-storage/async-storage';
import type {
  Callback,
  CallbackWithResult,
  KeyValuePair,
  MultiCallback,
  MultiGetCallback,
} from '@react-native-async-storage/async-storage/lib/typescript/types';

type WebStorageLegacy = import('../WebStorageLegacy').default;

let webStorageLegacyPromise: Promise<WebStorageLegacy> | undefined;

function getWebStorageLegacy(): Promise<WebStorageLegacy> {
  if (!webStorageLegacyPromise) {
    webStorageLegacyPromise = import('../WebStorageLegacy').then(
      ({ default: WebStorageLegacyClass }) => new WebStorageLegacyClass(),
    );
  }
  return webStorageLegacyPromise;
}

class LazyWebStorageLegacy implements AsyncStorageStatic {
  async isIndexedDB(): Promise<boolean> {
    const storage = await getWebStorageLegacy();
    return storage.isIndexedDB();
  }

  async clear(callback: Callback | undefined): Promise<void> {
    const storage = await getWebStorageLegacy();
    return storage.clear(callback);
  }

  async getAllKeys(
    callback: CallbackWithResult<readonly string[]> | undefined,
  ): Promise<readonly string[]> {
    const storage = await getWebStorageLegacy();
    return storage.getAllKeys(callback);
  }

  async getItem(
    key: string,
    callback: CallbackWithResult<string> | undefined,
  ): Promise<string | null> {
    const storage = await getWebStorageLegacy();
    return storage.getItem(key, callback);
  }

  async setItem(
    key: string,
    value: string,
    callback: Callback | undefined,
  ): Promise<void> {
    const storage = await getWebStorageLegacy();
    return storage.setItem(key, value, callback);
  }

  async removeItem(key: string, callback: Callback | undefined): Promise<void> {
    const storage = await getWebStorageLegacy();
    return storage.removeItem(key, callback);
  }

  flushGetRequests(): void {
    void getWebStorageLegacy().then((storage) => storage.flushGetRequests());
  }

  async mergeItem(
    key: string,
    value: string,
    callback: Callback | undefined,
  ): Promise<void> {
    const storage = await getWebStorageLegacy();
    return storage.mergeItem(key, value, callback);
  }

  async multiGet(
    keys: readonly string[],
    callback: MultiGetCallback | undefined,
  ): Promise<readonly KeyValuePair[]> {
    const storage = await getWebStorageLegacy();
    return storage.multiGet(keys, callback);
  }

  async multiMerge(
    keyValuePairs: readonly (readonly [string, string])[],
    callback: MultiCallback | undefined,
  ): Promise<void> {
    const storage = await getWebStorageLegacy();
    return storage.multiMerge(keyValuePairs, callback);
  }

  async multiRemove(
    keys: readonly string[],
    callback: MultiCallback | undefined,
  ): Promise<void> {
    const storage = await getWebStorageLegacy();
    return storage.multiRemove(keys, callback);
  }

  async multiSet(
    keyValuePairs: readonly (readonly [string, string])[],
    callback: MultiCallback | undefined,
  ): Promise<void> {
    const storage = await getWebStorageLegacy();
    return storage.multiSet(keyValuePairs, callback);
  }
}

const webStorageLegacy = new LazyWebStorageLegacy();

const webStorage = platformEnv.isJest
  ? webStorageLegacy
  : new WebStorage({
      dbName: 'OneKeyAppStorage',
      bucketName: 'app-storage_onekey-bucket',
      tableName: 'keyvaluepairs',
      legacyKeyPrefix: EWebStorageKeyPrefix.AppStorage,
    });

const webStorageSimpleDB = platformEnv.isJest
  ? webStorageLegacy
  : new WebStorage({
      dbName: 'OneKeySimpleDB',
      bucketName: 'simple-db_onekey-bucket',
      tableName: 'keyvaluepairs',
      legacyKeyPrefix: EWebStorageKeyPrefix.SimpleDB,
    });

const webStorageGlobalStates = platformEnv.isJest
  ? webStorageLegacy
  : new WebStorage({
      dbName: 'OneKeyGlobalStates',
      bucketName: 'global-states_onekey-bucket',
      tableName: 'keyvaluepairs',
      legacyKeyPrefix: EWebStorageKeyPrefix.GlobalStates,
    });

export {
  webStorageLegacy,
  webStorage,
  webStorageSimpleDB,
  webStorageGlobalStates,
};
