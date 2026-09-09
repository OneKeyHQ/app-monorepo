import { isPlainObject } from 'lodash';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import resetUtils from '../../utils/resetUtils';

import type {
  INativeSWRCachePatchIntent,
  INativeSyncStorageLocalMutation,
} from '../nativeStorageTypes';
import type { EAppSyncStorageKeys } from '../syncStorageKeys';

// ---- MMKV instance interface (subset used by wrapper) ---- cspell:ignore IMMKV

export type IMMKVInstance = {
  getString(key: string): string | undefined;
  getNumber(key: string): number | undefined;
  getBoolean(key: string): boolean | undefined;
  set(key: string, value: string | number | boolean): unknown;
  remove(key: string): unknown;
  clearAll(): unknown;
  getAllKeys(): string[];
  applySWRCachePatch?: (patch: INativeSWRCachePatchIntent) => unknown;
};

function normalizeMutationAcknowledgement(
  value: unknown,
): void | Promise<void> {
  if (
    value &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as { then?: unknown }).then === 'function'
  ) {
    return Promise.resolve(value as PromiseLike<unknown>).then(() => undefined);
  }
  return undefined;
}

// ---- Factory: create ISyncStorage wrapper from any MMKV instance ----

export function createMMKVSyncStorage<TKey extends string = string>(
  mmkv: IMMKVInstance,
  options?: {
    checkResetting?: boolean;
    onMutation?: (mutation: INativeSyncStorageLocalMutation) => void;
  },
) {
  const checkResetting = options?.checkResetting ?? false;

  /**
   * Safe MMKV set — guards against undefined/null values that crash MMKV.
   * undefined/null → writes empty string (key preserved, value cleared).
   */
  function safeSet(
    key: string,
    value: string | number | boolean | undefined | null,
  ) {
    if (checkResetting) {
      resetUtils.checkNotInResetting();
    }
    const normalizedValue = value === undefined || value === null ? '' : value;
    const acknowledgement = normalizeMutationAcknowledgement(
      mmkv.set(key, normalizedValue),
    );
    options?.onMutation?.({ operation: 'set', key, value: normalizedValue });
    return acknowledgement;
  }

  const storage = {
    set(key: TKey, value: boolean | string | number) {
      return safeSet(key, value);
    },
    setObject<T extends Record<string, any>>(key: TKey, value: T) {
      if (!isPlainObject(value)) {
        throw new OneKeyLocalError('value must be a plain object');
      }
      return safeSet(key, JSON.stringify(value));
    },
    getObject<T>(key: TKey): T | undefined {
      try {
        const raw = mmkv.getString(key);
        if (!raw) return undefined;
        return JSON.parse(raw) as T;
      } catch {
        return undefined;
      }
    },
    getString(key: TKey) {
      return mmkv.getString(key);
    },
    getNumber(key: TKey) {
      return mmkv.getNumber(key);
    },
    getBoolean(key: TKey) {
      return mmkv.getBoolean(key);
    },
    delete(key: TKey) {
      const acknowledgement = normalizeMutationAcknowledgement(
        mmkv.remove(key),
      );
      options?.onMutation?.({ operation: 'remove', key });
      return acknowledgement;
    },
    clearAll() {
      const acknowledgement = normalizeMutationAcknowledgement(mmkv.clearAll());
      options?.onMutation?.({ operation: 'clear' });
      return acknowledgement;
    },
    getAllKeys() {
      return mmkv.getAllKeys();
    },
  };
  return {
    ...storage,
    ...(mmkv.applySWRCachePatch
      ? { applySWRCachePatch: mmkv.applySWRCachePatch }
      : {}),
  } as typeof storage & {
    applySWRCachePatch?: (
      patch: INativeSWRCachePatchIntent,
    ) => void | Promise<void>;
  };
}

export type ISyncStorage<TKey extends string = EAppSyncStorageKeys> =
  ReturnType<typeof createMMKVSyncStorage<TKey>>;
