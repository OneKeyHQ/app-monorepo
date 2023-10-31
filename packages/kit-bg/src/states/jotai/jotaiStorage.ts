/* eslint-disable max-classes-per-file */
/* eslint-disable camelcase */
import { atom } from 'jotai';

import appStorage from '@onekeyhq/shared/src/storage/appStorage';

import { RESET } from './types';

import type {
  AsyncStorage,
  SetStateActionWithReset,
  SyncStorage,
  WritableAtom,
} from './types';

class JotaiStorage implements AsyncStorage<any> {
  async getItem(key: string, initialValue: any): Promise<any> {
    const r = await appStorage.getItem(key);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return r ?? initialValue;
  }

  async setItem(key: string, newValue: any): Promise<void> {
    const r = await appStorage.getItem(key);
    if (r !== newValue) {
      await appStorage.setItem(key, newValue);
    }
  }

  async removeItem(key: string): Promise<void> {
    await appStorage.removeItem(key);
  }

  subscribe = undefined;
}

export const onekeyJotaiStorage = new JotaiStorage();

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
  [SetStateActionWithReset<Value | Promise<Value>>],
  Promise<void>
>;

export function atomWithStorage<Value>(
  storageName: string,
  initialValue: Value,
  storage?: SyncStorage<Value>,
  unstable_options?: { unstable_getOnInit?: boolean },
): WritableAtom<Value, [SetStateActionWithReset<Value>], void>;

// TODO rename to atomPro
// - support async storage
// - support storage ready check (apply to raw atom and computed atom)
// - support Ext ui & bg sync
export function atomWithStorage<Value>(
  storageName: string,
  initialValue: Value,
  storage: AsyncStorage<Value> | SyncStorage<Value> = onekeyJotaiStorage,
  unstable_options?: { unstable_getOnInit?: boolean },
): any {
  const key = buildJotaiStorageKey(storageName);
  const getOnInit = unstable_options?.unstable_getOnInit ?? false;
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
    (get, set, update: SetStateActionWithReset<Value | Promise<Value>>) => {
      const nextValue =
        typeof update === 'function'
          ? (
              update as (
                prev: Value | Promise<Value>,
              ) => Value | Promise<Value> | typeof RESET
            )(get(baseAtom))
          : update;
      if (nextValue === RESET) {
        set(baseAtom, initialValue);
        return storage.removeItem(key);
      }
      if (nextValue instanceof Promise) {
        return nextValue.then((resolvedValue) => {
          set(baseAtom, resolvedValue);
          return storage.setItem(key, resolvedValue);
        });
      }
      set(baseAtom, nextValue);
      return storage.setItem(key, nextValue);
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
    console.log(this.resolveReady);
    this.resolveReady = resolve;
    console.log(this.resolveReady);
    if (this.resolveReady !== resolve) {
      throw new Error('update resolveReady callback failed');
    }
  });
}
export const globalJotaiStorageReadyHandler =
  new GlobalJotaiStorageReadyHandler();
