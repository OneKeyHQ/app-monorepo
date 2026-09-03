/* eslint-disable max-classes-per-file */
/* eslint-disable camelcase */
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { atom } from 'jotai';
import { isEqual, isPlainObject, isString, merge } from 'lodash';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { storageHub } from '@onekeyhq/shared/src/storage/appStorage';
import appStorageUtils from '@onekeyhq/shared/src/storage/appStorageUtils';
import { createPromiseTarget } from '@onekeyhq/shared/src/utils/promiseUtils';

import { atomsConfig } from './atomNames';
import { MMKV_MIGRATION_COMPLETE_KEY } from './jotaiStorageConsts';
import { createJotaiStorageNativeMMKV } from './jotaiStorageNativeMMKV';
import { JOTAI_RESET } from './types';
import jotaiVerify from './utils/jotaiVerify';

import type { IAtomNameKeys } from './atomNames';
import type { JotaiStorageNativeMMKV } from './jotaiStorageNativeMMKV';
import type {
  AsyncStorage,
  IJotaiSetStateActionWithReset,
  SyncStorage,
  WritableAtom,
} from './types';

const appStorage = storageHub.$webStorageGlobalStates || storageHub.appStorage;

export { MMKV_MIGRATION_COMPLETE_KEY };

// Arrays and class instances lose their identity under lodash merge just like
// primitives do (an array becomes an index keyed object, a Date becomes `{}`),
// so only plain objects are treated as mergeable.
function isMergeableValue(value: unknown): boolean {
  return isPlainObject(value);
}

// lodash merge is only meaningful between objects. Handed a primitive it spreads
// a string into a character-indexed object and reduces a number to `{}`, so the
// stored value stops comparing equal to anything the atom's consumers expect.
export function mergeStoredValue<Value>(
  initialValue: Value,
  nextValue: Value,
  shouldMergeInitialValue: boolean,
): Value {
  if (!shouldMergeInitialValue || !isMergeableValue(nextValue)) {
    return nextValue;
  }
  return merge({}, initialValue, nextValue) as Value;
}

const mockStorage = storageHub._mockStorage;

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
  if (platformEnv.isNativeBackgroundThread) {
    return createJotaiStorageNativeMMKV();
  }
  if (platformEnv.isNativeMainThread) {
    // UI state is hydrated from bg over RPC. UI persistence is intentionally
    // inert so neither MMKV nor legacy AsyncStorage is opened in this runtime.
    return mockStorage;
  }
  // web/desktop keep IndexedDB. L1 cold-start mirror was removed: sensitive
  // PersistAtom fields (sensitiveEncodeKey, encryptedSecurityPasswordR1) must
  // not be duplicated into a second IDB. L2 contextAtom snapshot + L3 SWR
  // cache still provide the meaningful first-paint TTI win.
  return new JotaiStorage();
}

export const onekeyJotaiStorage = createJotaiStorage();

export async function getNativeJotaiStorageEntries(): Promise<ReadonlyMap<
  string,
  unknown
> | null> {
  if (
    platformEnv.isNativeBackgroundThread &&
    'getAllEntries' in onekeyJotaiStorage
  ) {
    return await (onekeyJotaiStorage as JotaiStorageNativeMMKV).getAllEntries();
  }
  return null;
}

export async function clearNativeJotaiStorageForReset(): Promise<number> {
  if (
    platformEnv.isNativeBackgroundThread &&
    'clearAllForReset' in onekeyJotaiStorage
  ) {
    return await (
      onekeyJotaiStorage as JotaiStorageNativeMMKV
    ).clearAllForReset();
  }
  return 0;
}

export async function resetNativeJotaiStorageAfterMigrationMismatch(): Promise<void> {
  if (
    platformEnv.isNativeBackgroundThread &&
    'resetAfterMigrationMismatch' in onekeyJotaiStorage
  ) {
    await (
      onekeyJotaiStorage as JotaiStorageNativeMMKV
    ).resetAfterMigrationMismatch();
    return;
  }
  throw new OneKeyLocalError(
    'Jotai migration repair is restricted to the native background runtime',
  );
}

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

      const shouldMergeInitialValue =
        atomsConfig?.[storageName]?.mergeInitialValue ?? true;
      const newValue = mergeStoredValue(
        initialValue,
        nextValue,
        shouldMergeInitialValue,
      );

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

          const shouldMergeInitialValue =
            atomsConfig?.[storageName as any as IAtomNameKeys]
              ?.mergeInitialValue ?? true;
          const newValue = mergeStoredValue(
            initialValue,
            nextValue as Value,
            shouldMergeInitialValue,
          );

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
