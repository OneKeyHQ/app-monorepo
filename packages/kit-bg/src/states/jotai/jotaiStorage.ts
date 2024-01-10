/* eslint-disable max-classes-per-file */
/* eslint-disable camelcase */
import { atom } from 'jotai';
import { isString, merge } from 'lodash';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import appStorage, {
  mockStorage,
} from '@onekeyhq/shared/src/storage/appStorage';

import { JOTAI_RESET } from './types';

import type {
  AsyncStorage,
  IJotaiSetStateActionWithReset,
  SyncStorage,
  WritableAtom,
} from './types';

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
      await appStorage.setItem(key, JSON.stringify(newValue));
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

export function buildJotaiStorageKey(name: string) {
  const key = `global_states:${name}`;
  return key;
}

export function atomWithStorage<Value>(
  storageName: string,
  initialValue: Value,
  storage: AsyncStorage<Value>,
  unstable_options?: { unstable_getOnInit?: boolean },
): WritableAtom<
  Value | Promise<Value>,
  [IJotaiSetStateActionWithReset<Value | Promise<Value>>],
  Promise<void>
>;

export function atomWithStorage<Value>(
  storageName: string,
  initialValue: Value,
  storage?: SyncStorage<Value>,
  unstable_options?: { unstable_getOnInit?: boolean },
): WritableAtom<Value, [IJotaiSetStateActionWithReset<Value>], void>;

// TODO rename to atomPro
// - support async storage
// - support storage ready check (apply to raw atom and computed atom)
// - support Ext ui & bg sync
export function atomWithStorage<Value>(
  storageName: string,
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
    (
      get,
      set,
      update: IJotaiSetStateActionWithReset<Value | Promise<Value>>,
    ) => {
      const nextValue =
        typeof update === 'function'
          ? (
              update as (
                prev: Value | Promise<Value>,
              ) => Value | Promise<Value> | typeof JOTAI_RESET
            )(get(baseAtom))
          : update;
      if (nextValue === JOTAI_RESET) {
        set(baseAtom, initialValue);
        return storage.removeItem(key);
      }
      if (nextValue instanceof Promise) {
        return nextValue.then((resolvedValue) => {
          const mergedValue = merge({}, initialValue, resolvedValue);
          set(baseAtom, mergedValue);
          return storage.setItem(key, mergedValue);
        });
      }
      const mergedValue = merge({}, initialValue, nextValue);
      set(baseAtom, mergedValue);
      return storage.setItem(key, mergedValue);
    },
  );

  return anAtom;
}

class GlobalJotaiStorageReadyHandler {
  resolveReady: (value: boolean | PromiseLike<boolean>) => void = () => {
    // do nothing
    throw new Error('this is not expected to be called');
  };

  ready = new Promise<boolean>((resolve) => {
    this.resolveReady = resolve;
    if (this.resolveReady !== resolve) {
      throw new Error('update resolveReady callback failed');
    }
  });
}
export const globalJotaiStorageReadyHandler =
  new GlobalJotaiStorageReadyHandler();
