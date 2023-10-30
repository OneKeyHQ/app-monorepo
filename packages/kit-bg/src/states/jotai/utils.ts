/* eslint-disable camelcase */
import { atom, getDefaultStore, useAtom } from 'jotai';
import { RESET } from 'jotai/utils';
import { isNil } from 'lodash';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IGlobalStatesSyncBroadcastParams } from '@onekeyhq/shared/src/background/backgroundUtils';
import { GLOBAL_STATES_SYNC_BROADCAST_METHOD_NAME } from '@onekeyhq/shared/src/background/backgroundUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import type { Atom, PrimitiveAtom, WritableAtom } from 'jotai';
import type {
  ExtractAtomArgs,
  ExtractAtomResult,
  ExtractAtomValue,
} from 'jotai/vanilla';
import type {
  AsyncStorage,
  SyncStorage,
} from 'jotai/vanilla/utils/atomWithStorage';

type Unsubscribe = () => void;

type WithInitialValue<Value> = {
  init: Value;
};

type SetStateActionWithReset<Value> =
  | Value
  | typeof RESET
  | ((prev: Value) => Value | typeof RESET);

type Getter = <Value>(atom: Atom<Value>) => Value;
type Setter = <Value, Args extends unknown[], Result>(
  atom: WritableAtom<Value, Args, Result>,
  ...args: Args
) => Result;

type Read<Value, SetSelf = never> = (
  get: Getter,
  options: {
    readonly signal: AbortSignal;
    readonly setSelf: SetSelf;
  },
) => Value;

type SetAtom<Args extends unknown[], Result> = <A extends Args>(
  ...args: A
) => Result;

type Write<Args extends unknown[], Result> = (
  get: Getter,
  set: Setter,
  ...args: Args
) => Result;

class JotaiStorage implements AsyncStorage<any> {
  async getItem(key: string, initialValue: any): Promise<any> {
    const r = await appStorage.getItem(key);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return r ?? initialValue;
  }

  async setItem(key: string, newValue: any): Promise<void> {
    await appStorage.setItem(key, newValue);
  }

  async removeItem(key: string): Promise<void> {
    await appStorage.removeItem(key);
  }

  subscribe = undefined;
}
const onekeyJotaiStorage = new JotaiStorage();

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
  let updateAtomStorageReady: ((v: boolean) => void) | undefined;
  const key = `global_states:${storageName}`;
  const getOnInit = unstable_options?.unstable_getOnInit ?? false;
  const baseAtom = atom(
    getOnInit
      ? (storage.getItem(key, initialValue) as Value | Promise<Value>)
      : initialValue,
  );

  if (process.env.NODE_ENV !== 'production') {
    baseAtom.debugPrivate = true;
  }

  // TODO onMount not trigger when UI not reference this atom
  // TODO computed atom storage ready not working
  baseAtom.onMount = (async (setAtom: (value: Value) => void) => {
    if (!getOnInit) {
      const val = (await storage.getItem(key, initialValue)) as Value;
      setAtom(val);
      if (!updateAtomStorageReady) {
        throw new Error('updateAtomStorageReady is undefined');
      }
      updateAtomStorageReady(true);
    }
    let unsub: Unsubscribe | undefined;
    if (storage.subscribe) {
      unsub = storage.subscribe(key, setAtom, initialValue);
    }
    return unsub;
  }) as any;

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

  const storageReady = new Promise<boolean>((resolve) => {
    updateAtomStorageReady = resolve;
    if (process.env.NODE_ENV !== 'production') {
      // @ts-ignore
      global[`$$updateAtomStorageReady_${storageName}`] = resolve;
    }
  });
  // @ts-ignore
  anAtom.storageReady = storageReady;

  return anAtom;
}

// @ts-ignore
global.$globalStatsStorageReadyResolve = (v: boolean) => v;
// @ts-ignore
global.$globalStatsStorageReady = new Promise<boolean>(
  // @ts-ignore
  (resolve) => (global.$globalStatsStorageReadyResolve = resolve),
);
function enhanceAtom(name: string, baseAtom: ReturnType<typeof atom>) {
  const doSet = ({
    payload,
    proxyToBg,
    set,
  }: {
    payload: any;
    proxyToBg: boolean;
    set: Setter;
  }) => {
    if (proxyToBg && platformEnv.isExtensionUi) {
      // TODO call bg service to update states from bg and all ui
      return;
    }
    set(baseAtom, payload);
    console.log('------- enhanceAtom update to', name, payload);
    if (platformEnv.isExtensionBackground) {
      const p: IGlobalStatesSyncBroadcastParams = {
        $$isFromBgStatesSyncBroadcast: true,
        name,
        payload,
      };
      backgroundApiProxy.bridgeExtBg?.requestToAllUi({
        method: GLOBAL_STATES_SYNC_BROADCAST_METHOD_NAME,
        params: [p],
      });
    }
  };
  const proAtom = atom(
    (get) => get(baseAtom),
    (get, set, update) => {
      let nextValue =
        typeof update === 'function'
          ? (
              update as (
                prev: any | Promise<any>,
              ) => any | Promise<any> | typeof RESET
            )(get(baseAtom))
          : update;

      let proxyToBg = false;
      if (platformEnv.isExtensionUi) {
        proxyToBg = true;
        const nextValueFromBg = nextValue as IGlobalStatesSyncBroadcastParams;
        if (
          nextValueFromBg?.$$isFromBgStatesSyncBroadcast &&
          nextValueFromBg?.name === name
        ) {
          nextValue = nextValueFromBg.payload;
          proxyToBg = false;
        }
      }

      if (nextValue === RESET) {
        doSet({
          proxyToBg,
          set,
          payload: baseAtom.init,
        });
        return;
      }
      if (nextValue instanceof Promise) {
        return nextValue.then((resolvedValue) => {
          doSet({
            proxyToBg,
            set,
            payload: resolvedValue,
          });
        });
      }

      doSet({
        proxyToBg,
        set,
        payload: nextValue,
      });
    },
  );

  // @ts-ignore
  proAtom.storageReady = global.$globalStatsStorageReady;
  return proAtom;
}

const store = getDefaultStore();

export function makeCrossAtom<T extends () => any>(name: string, fn: T) {
  const atomBuilder = memoizee(fn, {
    primitive: true,
    normalizer: () => '',
  });

  const ready = async () => {
    const a = atomBuilder() as Atom<ExtractAtomValue<ReturnType<T>>>;
    // @ts-ignore
    await a.storageReady;
    // @ts-ignore
    if (isNil(a.storageReady)) {
      console.error('atom does not have storageReady checking: ', name);
    }
    return a;
  };

  return {
    target: {
      atom: atomBuilder,
      name,
      ready,
      get: async () => {
        const a = await ready();
        return store.get(a);
      },
      // TODO sync from bg to ui
      set: async <
        AtomValue extends ExtractAtomValue<ReturnType<T>>,
        Args extends ExtractAtomArgs<ReturnType<T>>,
        Result extends ExtractAtomResult<ReturnType<T>>,
      >(
        ...args: Args
      ) => {
        const a = (await ready()) as WritableAtom<AtomValue, Args, Result>;
        return store.set(a, ...args);
      },
    },
    // eslint-disable-next-line react-hooks/rules-of-hooks
    use: () => useAtom(atomBuilder() as ReturnType<T>),
  };
}

// initialValue
export function crossAtomBuilder<Value>({
  name,
  initialValue,
  read,
  write,
  storageName,
}: {
  name: string;
  initialValue: Value;
  //
  storageName?: string;
  read?: undefined;
  write?: undefined;
}): PrimitiveAtom<Value> & WithInitialValue<Value>;

// initialValue + storage
export function crossAtomBuilder<Value>({
  name,
  initialValue,
  read,
  write,
  storageName,
}: {
  name: string;
  initialValue: Value;
  storageName: string;
  //
  read?: undefined;
  write?: undefined;
}): ReturnType<typeof atomWithStorage<Value>>;

// Read only
export function crossAtomBuilder<Value>({
  name,
  initialValue,
  read,
  write,
  storageName,
}: {
  name: string;
  read: Read<Value>;
  //
  initialValue?: Value;
  storageName?: string;
  write?: undefined;
}): Atom<Value>;

// WriteOnly
export function crossAtomBuilder<Value, Args extends unknown[], Result>({
  name,
  initialValue,
  read,
  write,
  storageName,
}: {
  name: string;
  write: Write<Args, Result>;
  //
  initialValue?: Value;
  read?: undefined;
  storageName?: string;
}): WritableAtom<Value, Args, Result> & WithInitialValue<Value>;

// Read & Write
export function crossAtomBuilder<Value, Args extends unknown[], Result>({
  name,
  initialValue,
  read,
  write,
  storageName,
}: {
  name: string;
  read: Read<Value, SetAtom<Args, Result>>;
  write: Write<Args, Result>;
  //
  initialValue?: Value;
  storageName?: string;
}): WritableAtom<Value, Args, Result>;

export function crossAtomBuilder<Value, Args extends unknown[], Result>({
  name,
  initialValue,
  read,
  write,
  storageName,
}: {
  name: string;
  initialValue?: Value;
  storageName?: string;
  read?: Read<Value, SetAtom<Args, Result>> | Read<Value>;
  write?: Write<Args, Result>;
}) {
  let a = null;
  if (typeof write === 'function') {
    if (typeof read === 'function') {
      // read, write
      a = atom(read as Read<Value, SetAtom<Args, Result>>, write);
    } else {
      // initialValue, write
      a = atom(initialValue!, write);
    }
  } else if (typeof read === 'function') {
    // read
    a = atom(read as Read<Value>);
  } else if (storageName && typeof storageName === 'string') {
    // storage
    a = atomWithStorage(storageName, initialValue!);
  } else {
    // initialValue
    a = atom(initialValue!);
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return enhanceAtom(name, a as any) as unknown as any;
}

/*
(read: Read<Value, SetAtom<Args, Result>>, write: Write<Args, Result>): WritableAtom<Value, Args, Result>;

(read: Read<Value>): Atom<Value>;

(initialValue: Value, write: Write<Args, Result>): WritableAtom<Value, Args, Result> & WithInitialValue<Value>;

(initialValue: Value): PrimitiveAtom<Value> & WithInitialValue<Value>;
export {};
*/

export function globalAtom<Value, Args extends unknown[], Result>({
  initialValue,
  name,
  persist,
}: {
  name: string;
  initialValue?: Value;
  persist?: boolean;
}) {
  const initialValue0 = initialValue!;
  const storageName = persist ? name : undefined;
  return makeCrossAtom(name, () =>
    crossAtomBuilder({
      name,
      initialValue: initialValue0,
      storageName,
    }),
  );
}

export function globalAtomComputed<Value, Args extends unknown[], Result>({
  read,
  write,
  name,
}: {
  name: string;
  read?: Read<Value, SetAtom<Args, Result>> | Read<Value>;
  write?: Write<Args, Result>;
}) {
  if (typeof write === 'function' && typeof read === 'function') {
    // Read & Write
    return makeCrossAtom(name, () =>
      crossAtomBuilder({
        name,
        read: read as Read<Value, SetAtom<Args, Result>>,
        write,
      }),
    );
  }
  if (typeof write === 'function') {
    // Write
    return makeCrossAtom(name, () =>
      crossAtomBuilder({
        name,
        write,
      }),
    );
  }
  if (typeof read === 'function') {
    // Read
    return makeCrossAtom(name, () =>
      crossAtomBuilder({
        name,
        read: read as Read<Value>,
      }),
    );
  }
  throw new Error('write or read is missing');
}

export function globalAtomComputedRW<Value, Args extends unknown[], Result>({
  read,
  write,
  name,
}: {
  name: string;
  read: Read<Value, SetAtom<Args, Result>>;
  write: Write<Args, Result>;
}) {
  // Read & Write
  return makeCrossAtom(name, () =>
    crossAtomBuilder({
      name,
      read,
      write,
    }),
  );
}

export function globalAtomComputedR<Value>({
  read,
  name,
}: {
  name: string;
  read: Read<Value>;
}) {
  // Read
  return makeCrossAtom(name, () =>
    crossAtomBuilder({
      name,
      read,
    }),
  );
}

export function globalAtomComputedW<Value, Args extends unknown[], Result>({
  write,
  name,
}: {
  name: string;
  write: Write<Args, Result>;
}) {
  // Write
  return makeCrossAtom(name, () =>
    crossAtomBuilder({
      name,
      write,
    }),
  );
}
