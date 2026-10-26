import { callNativeStorage } from '../nativeStorageBridge';
import { reportUnsupportedAsyncStorageApi } from '../nativeStorageContractViolation';

import type {
  AsyncStorageStatic,
  IAsyncStorageKeyValuePair,
} from '../appStorageTypes';

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}

const nativeAsyncStorageImplementation: AsyncStorageStatic = {
  async getItem(key, callback) {
    try {
      const value = await callNativeStorage<string | null>({
        scope: 'asyncStorage',
        operation: 'getItem',
        key,
      });
      callback?.(null, value);
      return value;
    } catch (error) {
      const normalized = toError(error);
      callback?.(normalized);
      throw normalized;
    }
  },
  async setItem(key, value, callback) {
    try {
      await callNativeStorage<void>({
        scope: 'asyncStorage',
        operation: 'setItem',
        key,
        value,
      });
      callback?.(null);
    } catch (error) {
      const normalized = toError(error);
      callback?.(normalized);
      throw normalized;
    }
  },
  async removeItem(key, callback) {
    try {
      await callNativeStorage<void>({
        scope: 'asyncStorage',
        operation: 'removeItem',
        key,
      });
      callback?.(null);
    } catch (error) {
      const normalized = toError(error);
      callback?.(normalized);
      throw normalized;
    }
  },
  async mergeItem(key, value, callback) {
    try {
      await callNativeStorage<void>({
        scope: 'asyncStorage',
        operation: 'mergeItem',
        key,
        value,
      });
      callback?.(null);
    } catch (error) {
      const normalized = toError(error);
      callback?.(normalized);
      throw normalized;
    }
  },
  async clear(callback) {
    try {
      await callNativeStorage<void>({
        scope: 'asyncStorage',
        operation: 'clear',
      });
      callback?.(null);
    } catch (error) {
      const normalized = toError(error);
      callback?.(normalized);
      throw normalized;
    }
  },
  async getAllKeys(callback) {
    try {
      const keys = await callNativeStorage<string[]>({
        scope: 'asyncStorage',
        operation: 'getAllKeys',
      });
      callback?.(null, keys);
      return keys;
    } catch (error) {
      const normalized = toError(error);
      callback?.(normalized);
      throw normalized;
    }
  },
  flushGetRequests() {},
  async multiGet(keys, callback) {
    try {
      const entries = await callNativeStorage<IAsyncStorageKeyValuePair[]>({
        scope: 'asyncStorage',
        operation: 'multiGet',
        keys: [...keys],
      });
      callback?.(null, entries);
      return entries;
    } catch (error) {
      const normalized = toError(error);
      callback?.([normalized]);
      throw normalized;
    }
  },
  async multiSet(keyValuePairs, callback) {
    try {
      await callNativeStorage<void>({
        scope: 'asyncStorage',
        operation: 'multiSet',
        entries: keyValuePairs.map(([key, value]) => [key, value]),
      });
      callback?.(null);
    } catch (error) {
      const normalized = toError(error);
      callback?.([normalized]);
      throw normalized;
    }
  },
  async multiRemove(keys, callback) {
    try {
      await callNativeStorage<void>({
        scope: 'asyncStorage',
        operation: 'multiRemove',
        keys: [...keys],
      });
      callback?.(null);
    } catch (error) {
      const normalized = toError(error);
      callback?.([normalized]);
      throw normalized;
    }
  },
  async multiMerge(keyValuePairs, callback) {
    try {
      await callNativeStorage<void>({
        scope: 'asyncStorage',
        operation: 'multiMerge',
        entries: keyValuePairs.map(([key, value]) => [key, value]),
      });
      callback?.(null);
    } catch (error) {
      const normalized = toError(error);
      callback?.([normalized]);
      throw normalized;
    }
  },
};

const nativeAsyncStorageInstance: AsyncStorageStatic = new Proxy(
  nativeAsyncStorageImplementation,
  {
    get(target, property, receiver) {
      if (property === 'then' || property === '$$typeof') {
        return undefined;
      }
      if (typeof property === 'symbol' || Reflect.has(target, property)) {
        const value: unknown = Reflect.get(target, property, receiver);
        return value;
      }
      throw reportUnsupportedAsyncStorageApi(property);
    },
  },
);

export default nativeAsyncStorageInstance;
