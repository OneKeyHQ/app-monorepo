/* eslint-disable camelcase */
import { atom, getDefaultStore, useAtom } from 'jotai';
import { RESET } from 'jotai/utils';
import { isNil } from 'lodash';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IGlobalStatesSyncBroadcastParams } from '@onekeyhq/shared/src/background/backgroundUtils';
import { GLOBAL_STATES_SYNC_BROADCAST_METHOD_NAME } from '@onekeyhq/shared/src/background/backgroundUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import {
  atomWithStorage,
  globalJotaiStorageReadyHandler,
} from './jotaiStorage';

import type { EAtomNames } from './atomNames';
import type {
  IAtomPro,
  IWritableAtomPro,
  Read,
  SetAtom,
  Setter,
  WithInitialValue,
  Write,
} from './types';
import type { Atom, PrimitiveAtom, WritableAtom } from 'jotai';
import type {
  ExtractAtomArgs,
  ExtractAtomResult,
  ExtractAtomValue,
} from 'jotai/vanilla';

export const jotaiDefaultStore = getDefaultStore();

function wrapAtom(
  name: string,
  baseAtom: IWritableAtomPro<
    unknown,
    [update: unknown],
    Promise<void> | undefined
  >,
) {
  const doSet = async ({
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
    await set(baseAtom, payload);
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
    async (get, set, update) => {
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
        await doSet({
          proxyToBg,
          set,
          payload: baseAtom.initialValue,
        });
        return;
      }
      if (nextValue instanceof Promise) {
        return nextValue.then(async (resolvedValue) =>
          doSet({
            proxyToBg,
            set,
            payload: resolvedValue,
          }),
        );
      }

      await doSet({
        proxyToBg,
        set,
        payload: nextValue,
      });
    },
  ) as IWritableAtomPro<unknown, [update: unknown], Promise<void> | undefined>;

  return proAtom;
}

export class CrossAtom<T extends () => any> {
  constructor(name: string, atomBuilder: T) {
    this.name = name;
    this.atom = atomBuilder;
  }

  name: string;

  atom: T;

  ready = async () => {
    const a = this.atom() as IAtomPro<ExtractAtomValue<ReturnType<T>>>;
    await a.storageReady;
    if (isNil(a.storageReady)) {
      console.error('atom does not have storageReady checking: ', this.name);
    }
    return a;
  };

  get = async () => {
    const a = await this.ready();
    return jotaiDefaultStore.get(a);
  };

  set = async <
    AtomValue extends ExtractAtomValue<ReturnType<T>>,
    Args extends ExtractAtomArgs<ReturnType<T>>,
    Result extends ExtractAtomResult<ReturnType<T>>,
  >(
    ...args: Args
  ) => {
    const a = (await this.ready()) as IWritableAtomPro<AtomValue, Args, Result>;
    return jotaiDefaultStore.set(a, ...args);
  };
}

export function makeCrossAtom<T extends () => any>(name: string, fn: T) {
  const atomBuilder = memoizee(fn, {
    primitive: true,
    normalizer: () => '',
  });

  return {
    target: new CrossAtom(name, atomBuilder),
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
  let persist = false;
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
    persist = true;
  } else {
    // initialValue
    a = atom(initialValue!);
  }

  const baseAtom = a as IWritableAtomPro<
    unknown,
    [update: unknown],
    Promise<void> | undefined
  >;
  const proAtom = wrapAtom(name, baseAtom);
  proAtom.storageReady = globalJotaiStorageReadyHandler.ready;
  proAtom.initialValue = initialValue;
  proAtom.persist = persist;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return proAtom as unknown as any;
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
  name: EAtomNames;
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

// TODO TS issue fix
export function globalAtomComputed<Value, Args extends unknown[], Result>({
  read,
  write,
}: {
  read?: Read<Value, SetAtom<Args, Result>> | Read<Value>;
  write?: Write<Args, Result>;
}) {
  if (typeof write === 'function' && typeof read === 'function') {
    // Read & Write
    return makeCrossAtom('', () =>
      crossAtomBuilder({
        name: '',
        read: read as Read<Value, SetAtom<Args, Result>>,
        write,
      }),
    );
  }
  if (typeof write === 'function') {
    // Write
    return makeCrossAtom('', () =>
      crossAtomBuilder({
        name: '',
        write,
      }),
    );
  }
  if (typeof read === 'function') {
    // Read
    return makeCrossAtom('', () =>
      crossAtomBuilder({
        name: '',
        read: read as Read<Value>,
      }),
    );
  }
  throw new Error('write or read is missing');
}

export function globalAtomComputedRW<Value, Args extends unknown[], Result>({
  read,
  write,
}: {
  read: Read<Value, SetAtom<Args, Result>>;
  write: Write<Args, Result>;
}) {
  // Read & Write
  return makeCrossAtom('', () =>
    crossAtomBuilder({
      name: '',
      read,
      write,
    }),
  );
}

export function globalAtomComputedR<Value>({ read }: { read: Read<Value> }) {
  // Read
  return makeCrossAtom('', () =>
    crossAtomBuilder({
      name: '',
      read,
    }),
  );
}

export function globalAtomComputedW<Value, Args extends unknown[], Result>({
  write,
}: {
  write: Write<Args, Result>;
}) {
  // Write
  return makeCrossAtom('', () =>
    crossAtomBuilder({
      name: '',
      write,
    }),
  );
}
