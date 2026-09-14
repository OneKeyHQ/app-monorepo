/* eslint-disable max-classes-per-file */
/* eslint-disable camelcase */
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { atom } from 'jotai';
import { isEqual, isPlainObject, isString, merge } from 'lodash';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { storageHub } from '@onekeyhq/shared/src/storage/appStorage';
import appStorageUtils from '@onekeyhq/shared/src/storage/appStorageUtils';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import { createPromiseTarget } from '@onekeyhq/shared/src/utils/promiseUtils';

import { EAtomNames, atomsConfig } from './atomNames';
import {
  CURRENCY_REFERENCE_STORAGE_KEY,
  MANUAL_LOCK_CONTROL_STORAGE_KEY,
  MMKV_MIGRATION_COMPLETE_KEY,
  PASSWORD_CONTROL_STORAGE_KEY,
  SETTINGS_CONTROL_STORAGE_KEY,
} from './jotaiStorageConsts';
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
    const read = async () => {
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
    };
    const environment = await travelModeManager.getRuntimeEnvironment();
    return environment.persistence.run({
      operation: read,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      onBlocked: () => initialValue,
    });
  }

  async setItem(key: string, newValue: any): Promise<void> {
    const write = async () => {
      const r = await this.getItem(key, undefined);
      if (r !== newValue) {
        await appStorage.setItem(
          key,
          appStorageUtils.canSaveAsObject() && !isString(newValue)
            ? newValue
            : JSON.stringify(newValue),
        );
      }
    };
    const environment = await travelModeManager.getRuntimeEnvironment();
    return environment.persistence.run({
      operation: write,
      onBlocked: () => undefined,
    });
  }

  async removeItem(key: string): Promise<void> {
    const environment = await travelModeManager.getRuntimeEnvironment();
    await environment.persistence.run({
      operation: () => appStorage.removeItem(key),
      onBlocked: () => undefined,
    });
  }

  async getAllEntries(): Promise<Map<string, any> | null> {
    const environment = await travelModeManager.getRuntimeEnvironment();
    return environment.persistence.run({
      operation: async () => {
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
      },
      onBlocked: () => new Map<string, any>(),
    });
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

type IPasswordControlStorage = {
  getPasswordControlState(initialValue: unknown): Promise<unknown>;
  removePasswordControlState(): Promise<void>;
  setPasswordControlState(newValue: unknown): Promise<void>;
};

type ISettingsControlStorage = {
  getSettingsControlState(initialValue: unknown): Promise<unknown>;
  removeSettingsControlState(): Promise<void>;
  setSettingsControlState(newValue: unknown): Promise<void>;
};

type IManualLockControlStorage = {
  getManualLockControlState(initialValue: unknown): Promise<unknown>;
  removeManualLockControlState(): Promise<void>;
  setManualLockControlState(newValue: unknown): Promise<void>;
};

type ICurrencyReferenceStorage = {
  getCurrencyReferenceState(initialValue: unknown): Promise<unknown>;
};

function hasPasswordControlStorage(
  storage: AsyncStorage<any>,
): storage is AsyncStorage<any> & IPasswordControlStorage {
  return 'getPasswordControlState' in storage;
}

function hasSettingsControlStorage(
  storage: AsyncStorage<any>,
): storage is AsyncStorage<any> & ISettingsControlStorage {
  return 'getSettingsControlState' in storage;
}

function hasManualLockControlStorage(
  storage: AsyncStorage<any>,
): storage is AsyncStorage<any> & IManualLockControlStorage {
  return 'getManualLockControlState' in storage;
}

function hasCurrencyReferenceStorage(
  storage: AsyncStorage<any>,
): storage is AsyncStorage<any> & ICurrencyReferenceStorage {
  return 'getCurrencyReferenceState' in storage;
}

export async function getTravelModePasswordControlState(
  initialValue: unknown,
): Promise<unknown> {
  if (hasPasswordControlStorage(onekeyJotaiStorage)) {
    return onekeyJotaiStorage.getPasswordControlState(initialValue);
  }
  return onekeyJotaiStorage.getItem(PASSWORD_CONTROL_STORAGE_KEY, initialValue);
}

async function setTravelModePasswordControlState(
  newValue: unknown,
): Promise<void> {
  if (hasPasswordControlStorage(onekeyJotaiStorage)) {
    return onekeyJotaiStorage.setPasswordControlState(newValue);
  }
  await onekeyJotaiStorage.setItem(PASSWORD_CONTROL_STORAGE_KEY, newValue);
}

async function removeTravelModePasswordControlState(): Promise<void> {
  if (hasPasswordControlStorage(onekeyJotaiStorage)) {
    return onekeyJotaiStorage.removePasswordControlState();
  }
  await onekeyJotaiStorage.removeItem(PASSWORD_CONTROL_STORAGE_KEY);
}

const passwordControlJotaiStorage: AsyncStorage<any> = {
  getItem: (_key, initialValue) =>
    getTravelModePasswordControlState(initialValue),
  removeItem: () => removeTravelModePasswordControlState(),
  setItem: (_key, newValue) => setTravelModePasswordControlState(newValue),
  subscribe: undefined,
};

export async function getTravelModeManualLockControlState(
  initialValue: unknown,
): Promise<unknown> {
  if (hasManualLockControlStorage(onekeyJotaiStorage)) {
    return onekeyJotaiStorage.getManualLockControlState(initialValue);
  }
  return onekeyJotaiStorage.getItem(
    MANUAL_LOCK_CONTROL_STORAGE_KEY,
    initialValue,
  );
}

async function setTravelModeManualLockControlState(
  newValue: unknown,
): Promise<void> {
  if (hasManualLockControlStorage(onekeyJotaiStorage)) {
    return onekeyJotaiStorage.setManualLockControlState(newValue);
  }
  await onekeyJotaiStorage.setItem(MANUAL_LOCK_CONTROL_STORAGE_KEY, newValue);
}

async function removeTravelModeManualLockControlState(): Promise<void> {
  if (hasManualLockControlStorage(onekeyJotaiStorage)) {
    return onekeyJotaiStorage.removeManualLockControlState();
  }
  await onekeyJotaiStorage.removeItem(MANUAL_LOCK_CONTROL_STORAGE_KEY);
}

const manualLockControlJotaiStorage: AsyncStorage<any> = {
  getItem: (_key, initialValue) =>
    getTravelModeManualLockControlState(initialValue),
  removeItem: () => removeTravelModeManualLockControlState(),
  setItem: (_key, newValue) => setTravelModeManualLockControlState(newValue),
  subscribe: undefined,
};

export async function getTravelModeSettingsControlState(
  initialValue: unknown,
): Promise<unknown> {
  if (hasSettingsControlStorage(onekeyJotaiStorage)) {
    return onekeyJotaiStorage.getSettingsControlState(initialValue);
  }
  return onekeyJotaiStorage.getItem(SETTINGS_CONTROL_STORAGE_KEY, initialValue);
}

async function setTravelModeSettingsControlState(
  newValue: unknown,
): Promise<void> {
  if (hasSettingsControlStorage(onekeyJotaiStorage)) {
    return onekeyJotaiStorage.setSettingsControlState(newValue);
  }
  await onekeyJotaiStorage.setItem(SETTINGS_CONTROL_STORAGE_KEY, newValue);
}

async function removeTravelModeSettingsControlState(): Promise<void> {
  if (hasSettingsControlStorage(onekeyJotaiStorage)) {
    return onekeyJotaiStorage.removeSettingsControlState();
  }
  await onekeyJotaiStorage.removeItem(SETTINGS_CONTROL_STORAGE_KEY);
}

const settingsControlJotaiStorage: AsyncStorage<any> = {
  getItem: (_key, initialValue) =>
    getTravelModeSettingsControlState(initialValue),
  removeItem: () => removeTravelModeSettingsControlState(),
  setItem: (_key, newValue) => setTravelModeSettingsControlState(newValue),
  subscribe: undefined,
};

export async function getTravelModeCurrencyReferenceState(
  initialValue: unknown,
): Promise<unknown> {
  if (hasCurrencyReferenceStorage(onekeyJotaiStorage)) {
    return onekeyJotaiStorage.getCurrencyReferenceState(initialValue);
  }
  return onekeyJotaiStorage.getItem(
    CURRENCY_REFERENCE_STORAGE_KEY,
    initialValue,
  );
}

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
  let storage: AsyncStorage<any> = onekeyJotaiStorage;
  if (storageName === EAtomNames.passwordPersistAtom) {
    storage = passwordControlJotaiStorage;
  } else if (storageName === EAtomNames.passwordPersistManualLockStateAtom) {
    storage = manualLockControlJotaiStorage;
  } else if (storageName === EAtomNames.settingsPersistAtom) {
    storage = settingsControlJotaiStorage;
  }
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
