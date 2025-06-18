/* eslint-disable max-classes-per-file */
/* eslint-disable camelcase */
import { atom } from 'jotai';
import { isEqual, isString, merge } from 'lodash';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { storageHub } from '@onekeyhq/shared/src/storage/appStorage';
import appStorageUtils from '@onekeyhq/shared/src/storage/appStorageUtils';
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

  subscribe = undefined;
}

export const onekeyJotaiStorage = platformEnv.isExtensionUi
  ? mockStorage // extension real storage is running at bg, the ui is a mock storage
  : new JotaiStorage();

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
          update as (
            prev: any | Promise<any>,
          ) => any | Promise<any> | typeof JOTAI_RESET
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
  resolveReady: (value: boolean | PromiseLike<boolean>) => void = () => {
    // do nothing
    throw new OneKeyLocalError('this is not expected to be called');
  };

  ready = new Promise<boolean>((resolve) => {
    this.resolveReady = resolve;
    if (this.resolveReady !== resolve) {
      throw new OneKeyLocalError('update resolveReady callback failed');
    }
  });
}
export const globalJotaiStorageReadyHandler =
  new GlobalJotaiStorageReadyHandler();
