/* eslint-disable max-classes-per-file */
/* eslint-disable camelcase */
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { atom } from 'jotai';
import { isEqual, isString, merge } from 'lodash';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { storageHub } from '@onekeyhq/shared/src/storage/appStorage';
import appStorageUtils from '@onekeyhq/shared/src/storage/appStorageUtils';
import type { ISyncStorage } from '@onekeyhq/shared/src/storage/instance/syncStorageInstance';
import { createPromiseTarget } from '@onekeyhq/shared/src/utils/promiseUtils';

import { atomsConfig } from './atomNames';
import { JOTAI_RESET } from './types';
import jotaiVerify from './utils/jotaiVerify';

import type { IAtomNameKeys } from './atomNames';
import type {
  AsyncStorage,
  IJotaiSetStateActionWithReset,
  SyncStorage,
  WritableAtom,
} from './types';

const appStorage = storageHub.$webStorageGlobalStates || storageHub.appStorage;
const mockStorage = storageHub._mockStorage;

export const MMKV_MIGRATION_COMPLETE_KEY = '__mmkv_migration_v1__';

class JotaiStorageNativeMMKV implements AsyncStorage<any> {
  /** Safe MMKV wrapper — null/undefined guarded via createMMKVSyncStorage */
  private store: ISyncStorage;

  /** Raw MMKV instance for getString/getAllKeys (read-only) */
  private mmkv: {
    getString(key: string): string | undefined;
    getAllKeys(): string[];
  };

  /** Cached migration status — set once, never reverts to false. */
  private migrated: boolean;

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { default: instance } =
      require('@onekeyhq/shared/src/storage/instance/jotaiMMKVStorageInstance') as typeof import('@onekeyhq/shared/src/storage/instance/jotaiMMKVStorageInstance');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createMMKVSyncStorage } =
      require('@onekeyhq/shared/src/storage/instance/syncStorageInstance') as typeof import('@onekeyhq/shared/src/storage/instance/syncStorageInstance');
    this.store = createMMKVSyncStorage(instance, { checkResetting: true });
    this.mmkv = instance;
    this.migrated = instance.getString(MMKV_MIGRATION_COMPLETE_KEY) === '1';
  }

  private log(msg: string) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { NativeLogger, LogLevel } =
        require('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger') as typeof import('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger');
      NativeLogger.write(LogLevel.Info, `[JotaiStorageMMKV] ${msg}`);
    } catch {
      /* noop */
    }
  }

  private getAsyncStorageModule() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const asyncStorage =
      require('@react-native-async-storage/async-storage') as typeof import('@react-native-async-storage/async-storage');
    return asyncStorage.default;
  }

  /**
   * Read from legacy AsyncStorage. Returns null if key doesn't exist.
   * Throws on actual read errors (callers decide how to handle).
   */
  private async readFromAsyncStorage(key: string): Promise<any> {
    const data = await this.getAsyncStorageModule().getItem(key);
    if (data === null) return null;
    try {
      return isString(data) ? JSON.parse(data) : data;
    } catch {
      return null;
    }
  }

  private async writeToAsyncStorage(key: string, value: any): Promise<void> {
    await this.getAsyncStorageModule().setItem(key, JSON.stringify(value));
  }

  // ---- Migration-aware read/write ----

  async getItem(key: string, initialValue: any): Promise<any> {
    if (this.migrated) {
      // Migration done — MMKV is source of truth
      const raw = this.mmkv.getString(key);
      if (raw !== undefined) {
        try {
          const parsed = JSON.parse(raw);
          // Legacy entries where a null was persisted as the string "null"
          // should behave like "cleared" and fall back to initialValue.
          if (parsed !== null) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return parsed;
          }
        } catch (e) {
          this.log(`MMKV parse failed for ${key}: ${(e as Error)?.message}`);
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return initialValue;
    }

    // Migration not done — AsyncStorage is source of truth
    try {
      const value = await this.readFromAsyncStorage(key);
      if (value !== null && value !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return value;
      }
    } catch (e) {
      this.log(`AsyncStorage read failed for ${key}: ${(e as Error)?.message}`);
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return initialValue;
  }

  async setItem(key: string, newValue: any): Promise<void> {
    // undefined/null writes → route to removeItem. Persisting JSON.stringify(null) ("null")
    // would later parse back to `null` and be returned by getItem instead of the atom's
    // initialValue, breaking initialization after restart. Treat both as "cleared".
    if (newValue === undefined || newValue === null) {
      await this.removeItem(key);
      return;
    }

    this.store.set(key as any, JSON.stringify(newValue));

    if (!this.migrated) {
      // Migration not done — also write to AsyncStorage so it stays
      // up-to-date as fallback and for next migration retry
      try {
        await this.writeToAsyncStorage(key, newValue);
      } catch {
        /* best-effort */
      }
    }
  }

  async removeItem(key: string): Promise<void> {
    this.store.delete(key as any);
    if (!this.migrated) {
      try {
        await this.getAsyncStorageModule().removeItem(key);
      } catch {
        /* best-effort */
      }
    }
  }

  /**
   * Check if BG thread has completed the one-time AsyncStorage → MMKV migration.
   * Main thread uses this to decide whether to read MMKV per-key or old snapshot blob.
   */
  isMigrationComplete(): boolean {
    return this.migrated;
  }

  /**
   * One-time proactive migration: batch-read ALL expected atom keys from
   * AsyncStorage and write to MMKV. Called by jotaiInit() on BG thread.
   *
   * Completeness guarantee:
   * - Iterates every key in EAtomNames (exhaustive enum of all atoms)
   * - Always overwrites existing MMKV keys (previous partial migration
   *   may have left stale data; AsyncStorage is kept up-to-date via
   *   dual-write in setItem, so it's always the authoritative source)
   * - Tracks errors separately from "key not found"
   * - Migration-complete flag set ONLY when zero errors
   * - On failure: flag not set → getItem/setItem stay in dual-write mode
   *   → retry next launch
   */
  async migrateFromAsyncStorage(
    expectedKeys: string[],
    probeKey: string,
  ): Promise<void> {
    if (this.migrated) {
      this.log('migration already complete, skip');
      return;
    }

    // Fast probe: read one key that every existing user has (settingsPersistAtom).
    // If absent → first install, nothing to migrate → set flag and return.
    try {
      const probe = await this.getAsyncStorageModule().getItem(probeKey);
      if (probe === null) {
        this.store.set(MMKV_MIGRATION_COMPLETE_KEY as any, '1');
        this.migrated = true;
        this.log('migration skip: first install (probe key absent)');
        return;
      }
    } catch (e) {
      this.log(
        `migration probe failed: ${(e as Error)?.message}, proceeding with full migration`,
      );
    }

    this.log(`migration start: ${expectedKeys.length} keys to check`);
    let migrated = 0;
    let absent = 0;
    let errors = 0;
    await Promise.all(
      expectedKeys.map(async (key) => {
        try {
          const value = await this.readFromAsyncStorage(key);
          if (value !== null && value !== undefined) {
            this.store.set(key as any, JSON.stringify(value) ?? '');
            migrated += 1;
          } else {
            absent += 1;
          }
        } catch (e) {
          errors += 1;
          this.log(`migration read error for ${key}: ${(e as Error)?.message}`);
        }
      }),
    );

    if (errors === 0) {
      this.store.set(MMKV_MIGRATION_COMPLETE_KEY as any, '1');
      this.migrated = true;
      this.log(`migration complete: ${migrated} migrated, ${absent} absent`);
    } else {
      this.log(
        `migration incomplete: ${migrated} migrated, ${errors} errors — will retry next launch`,
      );
    }
  }

  async getAllEntries(): Promise<Map<string, any> | null> {
    if (!this.migrated) {
      // Migration not done — signal caller to use individual getItem
      // (which falls back to AsyncStorage)
      return null;
    }
    const map = new Map<string, any>();
    const keys = this.mmkv
      .getAllKeys()
      .filter((k) => k !== MMKV_MIGRATION_COMPLETE_KEY);
    for (const key of keys) {
      const raw = this.mmkv.getString(key);
      if (raw !== undefined) {
        try {
          map.set(key, JSON.parse(raw));
        } catch {
          map.set(key, undefined);
        }
      }
    }
    return map;
  }

  subscribe = undefined;
}

class JotaiStorage implements AsyncStorage<any> {
  async getItem(key: string, initialValue: any): Promise<any> {
    let data: string | null = await appStorage.getItem(key);
    if (isString(data)) {
      try {
        data = JSON.parse(data);
      } catch (e) {
        console.error(e);
        data = null;
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return data ?? initialValue;
  }

  async setItem(key: string, newValue: any): Promise<void> {
    const r = await this.getItem(key, undefined);
    if (r !== newValue) {
      await appStorage.setItem(
        key,
        appStorageUtils.canSaveAsObject() && !isString(newValue)
          ? newValue
          : JSON.stringify(newValue),
      );
    }
  }

  async removeItem(key: string): Promise<void> {
    await appStorage.removeItem(key);
  }

  async getAllEntries(): Promise<Map<string, any> | null> {
    if (typeof (appStorage as any).getAllEntries === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const rawMap: Map<string, any> = await (
        appStorage as any
      ).getAllEntries();
      const parsedMap = new Map<string, any>();
      for (const [key, value] of rawMap) {
        if (isString(value)) {
          try {
            parsedMap.set(key, JSON.parse(value));
          } catch {
            parsedMap.set(key, undefined);
          }
        } else {
          parsedMap.set(key, value ?? undefined);
        }
      }
      return parsedMap;
    }
    // Return null to signal batch read is not supported (e.g., mobile native storage)
    return null;
  }

  subscribe = undefined;
}

function createJotaiStorage() {
  if (platformEnv.isExtensionUi) {
    // extension real storage is running at bg, the ui is a mock storage
    return mockStorage;
  }
  if (platformEnv.isNative) {
    return new JotaiStorageNativeMMKV();
  }
  // web/desktop keep IndexedDB
  return new JotaiStorage();
}

export const onekeyJotaiStorage = createJotaiStorage();

export function buildJotaiStorageKey(name: IAtomNameKeys) {
  const key = `g_states_v5:${name}`;
  return key;
}

export function atomWithStorage<Value>(
  storageName: IAtomNameKeys,
  initialValue: Value,
  storage: AsyncStorage<Value>,
  unstable_options?: { unstable_getOnInit?: boolean },
): WritableAtom<
  Value | Promise<Value>,
  [IJotaiSetStateActionWithReset<Value | Promise<Value>>],
  Promise<void>
>;

export function atomWithStorage<Value>(
  storageName: IAtomNameKeys,
  initialValue: Value,
  storage?: SyncStorage<Value>,
  unstable_options?: { unstable_getOnInit?: boolean },
): WritableAtom<Value, [IJotaiSetStateActionWithReset<Value>], void>;

// TODO rename to atomPro
// - support async storage
// - support storage ready check (apply to raw atom and computed atom)
// - support Ext ui & bg sync
export function atomWithStorage<Value>(
  storageName: IAtomNameKeys,
  initialValue: Value,
): any {
  const storage = onekeyJotaiStorage;
  const key = buildJotaiStorageKey(storageName);
  const getOnInit = false;
  const baseAtom = atom(
    getOnInit
      ? (storage.getItem(key, initialValue) as Value | Promise<Value>)
      : initialValue,
  );

  if (process.env.NODE_ENV !== 'production') {
    baseAtom.debugPrivate = true;
  }

  const anAtom = atom(
    (get) => get(baseAtom),
    async (
      get,
      set,
      update: IJotaiSetStateActionWithReset<Value | Promise<Value>>,
    ) => {
      jotaiVerify.ensureNotPromise(update);

      let nextValue = update;
      let prevValue: Value | Promise<Value> | undefined;
      if (typeof update === 'function') {
        prevValue = get(baseAtom);

        if (prevValue instanceof Promise) {
          prevValue = await prevValue;
        }
        jotaiVerify.ensureNotPromise(prevValue);

        nextValue = (
          update as (prev: any | Promise<any>) => any | Promise<any>
        )(prevValue);
      }

      if (nextValue instanceof Promise) {
        nextValue = await nextValue;
      }
      jotaiVerify.ensureNotPromise(nextValue);

      if (nextValue === JOTAI_RESET) {
        set(baseAtom, initialValue);
        return storage.removeItem(key);
      }

      const newValue = merge({}, initialValue, nextValue);

      const shouldDeepCompare =
        atomsConfig?.[storageName]?.deepCompare ?? false;

      if (shouldDeepCompare) {
        prevValue = prevValue ?? get(baseAtom);
        if (prevValue instanceof Promise) {
          prevValue = await prevValue;
        }
        jotaiVerify.ensureNotPromise(prevValue);
        if (isEqual(newValue, prevValue)) {
          return;
        }
      }

      set(baseAtom, newValue);
      return storage.setItem(key, newValue);
    },
  );

  // TODO : A component suspended while responding to synchronous input. This will cause the UI to be replaced with a loading indicator. To fix, updates that suspend should be wrapped with startTransition.
  // error muted by withSentryHOC
  atom(
    (get) => get(baseAtom),
    async (
      get,
      set,
      update: IJotaiSetStateActionWithReset<Value | Promise<Value>>,
    ) => {
      jotaiVerify.ensureNotPromise(update);
      const p = createPromiseTarget<boolean>();

      set(baseAtom, async (prevValue) => {
        const value = (async () => {
          if (prevValue instanceof Promise) {
            // eslint-disable-next-line no-param-reassign
            prevValue = await prevValue;
          }
          jotaiVerify.ensureNotPromise(prevValue);

          let nextValue =
            typeof update === 'function'
              ? (
                  update as (
                    prev: Value | Promise<Value>,
                  ) => Value | Promise<Value> | typeof JOTAI_RESET
                )(prevValue)
              : update;

          if (nextValue instanceof Promise) {
            // eslint-disable-next-line no-param-reassign
            nextValue = await nextValue;
          }
          jotaiVerify.ensureNotPromise(nextValue);

          if (nextValue === JOTAI_RESET) {
            await storage.removeItem(key);
            return initialValue;
          }

          const newValue = merge({}, initialValue, nextValue) as Value;

          const shouldDeepCompare =
            atomsConfig?.[storageName as any as IAtomNameKeys]?.deepCompare ??
            false;

          if (shouldDeepCompare) {
            if (isEqual(newValue, prevValue)) {
              await storage.setItem(key, prevValue);
              return prevValue;
            }
          }

          await storage.setItem(key, newValue);
          return newValue;
        })();

        p.resolveTarget(true, 5000);
        return value;
      });

      const v = await p.ready;
      return v;
    },
  );

  return anAtom;
}

class GlobalJotaiStorageReadyHandler {
  isReady = false;

  resolveReady: (value: boolean | PromiseLike<boolean>) => void = () => {
    // do nothing
    throw new OneKeyLocalError('this is not expected to be called');
  };

  ready = new Promise<boolean>((resolve) => {
    const wrappedResolve = (value: boolean | PromiseLike<boolean>) => {
      this.isReady = true;
      resolve(value);
    };
    this.resolveReady = wrappedResolve;
    if (this.resolveReady !== wrappedResolve) {
      throw new OneKeyLocalError('update resolveReady callback failed');
    }
  });
}
export const globalJotaiStorageReadyHandler =
  new GlobalJotaiStorageReadyHandler();
