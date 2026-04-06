/* eslint-disable camelcase */
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { atom, useAtom } from 'jotai';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import {
  atomWithStorage,
  globalJotaiStorageReadyHandler,
} from '../jotaiStorage';

import { JotaiCrossAtom } from './JotaiCrossAtom';
import { wrapAtomPro } from './wrapAtomPro';

import type { EAtomNames, IAtomNameKeys } from '../atomNames';
import type {
  IJotaiAtomProProps,
  IJotaiGetter,
  IJotaiRead,
  IJotaiSetAtom,
  IJotaiSetter,
  IJotaiWithInitialValue,
  IJotaiWritableAtomPro,
  IJotaiWrite,
} from '../types';
import type { Atom, PrimitiveAtom, WritableAtom } from 'jotai';

/** Global registry of atom name → JotaiCrossAtom, populated at module load time.
 *  Used by jotaiInitFromUi to set cached values WITHOUT importing the barrel. */
export const globalAtomRegistry = new Map<string, JotaiCrossAtom<any>>();

export function makeCrossAtom<T extends () => any>(name: string, fn: T) {
  const atomBuilder = memoizee(fn, {
    primitive: true,
    normalizer: () => '',
  });

  const crossAtom = new JotaiCrossAtom(name, atomBuilder);
  // Register named atoms so jotaiInitFromUi can find them without barrel import
  if (name) {
    globalAtomRegistry.set(name, crossAtom);
  }

  return {
    target: crossAtom,
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
  storageName?: IAtomNameKeys;
  read?: undefined;
  write?: undefined;
}): PrimitiveAtom<Value> & IJotaiWithInitialValue<Value>;

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
  storageName: IAtomNameKeys;
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
  read: IJotaiRead<Value>;
  //
  initialValue?: Value;
  storageName?: IAtomNameKeys;
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
  write: IJotaiWrite<Args, Result>;
  //
  initialValue?: Value;
  read?: undefined;
  storageName?: IAtomNameKeys;
}): WritableAtom<Value, Args, Result> & IJotaiWithInitialValue<Value>;

// Read & Write
export function crossAtomBuilder<Value, Args extends unknown[], Result>({
  name,
  initialValue,
  read,
  write,
  storageName,
}: {
  name: string;
  read: IJotaiRead<Value, IJotaiSetAtom<Args, Result>>;
  write: IJotaiWrite<Args, Result>;
  //
  initialValue?: Value;
  storageName?: IAtomNameKeys;
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
  storageName?: IAtomNameKeys;
  read?: IJotaiRead<Value, IJotaiSetAtom<Args, Result>> | IJotaiRead<Value>;
  write?: IJotaiWrite<Args, Result>;
}) {
  let a = null;
  let persist = false;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  let initialVal = Object.freeze(initialValue!);

  // If MMKV snapshot was pre-loaded, use cached value as initialValue
  // so the atom starts with the correct persisted value immediately.
  const snapshotStates = (globalThis as any).__ONEKEY_JOTAI_INIT_STATES__;
  if (snapshotStates && name && name in snapshotStates) {
    const cached = snapshotStates[name];
    if (cached !== undefined && cached !== null) {
      initialVal = Object.freeze(
        typeof initialValue === 'object' && typeof cached === 'object'
          ? { ...initialValue, ...cached }
          : cached,
      ) as Value & Readonly<Value>;
    }
  }

  if (typeof write === 'function') {
    if (typeof read === 'function') {
      // read, write
      a = atom(read as IJotaiRead<Value, IJotaiSetAtom<Args, Result>>, write);
    } else {
      // initialValue, write
      a = atom(initialVal, write);
    }
  } else if (typeof read === 'function') {
    // read
    a = atom(read as IJotaiRead<Value>);
  } else if (storageName && typeof storageName === 'string') {
    // storage
    a = atomWithStorage(storageName, initialVal);
    persist = true;
  } else {
    // initialValue
    a = atom(initialVal);
  }

  const baseAtom = a as IJotaiWritableAtomPro<
    unknown,
    [update: unknown],
    Promise<void> | undefined
  >;
  baseAtom.initialValue = initialVal;
  const proAtom = wrapAtomPro(name as EAtomNames, baseAtom);
  proAtom.storageReady = globalJotaiStorageReadyHandler.ready;
  proAtom.initialValue = initialVal;
  proAtom.persist = persist;
  proAtom.$$isGlobalAtom = true;
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

export function globalAtom<Value>({
  initialValue,
  name,
  persist,
}: {
  name: EAtomNames;
  initialValue: Value;
  persist?: boolean;
}) {
  const storageName = persist ? name : undefined;
  return makeCrossAtom(name, () =>
    crossAtomBuilder({
      name,
      initialValue,
      storageName,
    }),
  );
}

// TODO TS issue fix
export function globalAtomComputedAll<Value, Args extends unknown[], Result>({
  read,
  write,
}: {
  read?: IJotaiRead<Value, IJotaiSetAtom<Args, Result>> | IJotaiRead<Value>;
  write?: IJotaiWrite<Args, Result>;
}) {
  if (typeof write === 'function' && typeof read === 'function') {
    // Read & Write
    return makeCrossAtom('', () =>
      crossAtomBuilder({
        name: '',
        read: read as IJotaiRead<Value, IJotaiSetAtom<Args, Result>>,
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
        read: read as IJotaiRead<Value>,
      }),
    );
  }
  throw new OneKeyLocalError('write or read is missing');
}

export function globalAtomComputedRW<Value, Args extends unknown[], Result>({
  read,
  write,
}: {
  read: IJotaiRead<Value, IJotaiSetAtom<Args, Result>>;
  write: IJotaiWrite<Args, Result>;
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

export function globalAtomComputedR<Value>({
  read,
}: {
  read: IJotaiRead<Value>;
}) {
  // Read
  return makeCrossAtom('', () =>
    crossAtomBuilder({
      name: '',
      read,
    }),
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function globalAtomComputedW<Value, Args extends unknown[], Result>({
  write,
}: {
  write: IJotaiWrite<Args, Result>;
}) {
  // Write
  return makeCrossAtom('', () =>
    crossAtomBuilder({
      name: '',
      write,
    }),
  );
}

export function globalAtomComputed<Value>(read: IJotaiRead<Value>) {
  // Read
  return globalAtomComputedR({ read });
}

/**
 * Registry of named contextAtoms for MMKV snapshot save/restore.
 * Unlike globalAtomRegistry (for globalAtoms), this tracks contextAtom
 * name→atomBuilder mappings so snapshot injection can work.
 */
export const contextAtomSnapshotRegistry = new Map<
  string,
  { atom: () => any }
>();

export function contextAtomBase<Value>({
  initialValue,
  useContextAtom,
  name,
}: {
  initialValue: Value;
  name?: string;
  useContextAtom: <Value2, Args extends any[], Result>(
    atomInstance: WritableAtom<Value2, Args, Result>,
  ) => [Awaited<Value2>, IJotaiSetAtom<Args, Result>];
}) {
  // If named and MMKV snapshot has cached value, use it as initialValue
  let resolvedInitialValue = initialValue;
  if (name) {
    const snapshotStates = (globalThis as any).__ONEKEY_JOTAI_INIT_STATES__;
    if (snapshotStates && name in snapshotStates) {
      const cached = snapshotStates[name];
      if (cached !== undefined && cached !== null) {
        resolvedInitialValue =
          typeof initialValue === 'object' && typeof cached === 'object'
            ? { ...initialValue, ...cached }
            : cached;
      }
    }
  }

  const atomBuilder = memoizee(() => atom(resolvedInitialValue));
  const useFn = () => useContextAtom(atomBuilder());

  if (name) {
    contextAtomSnapshotRegistry.set(name, { atom: atomBuilder });
  }

  return {
    useContextAtom,
    atom: atomBuilder,
    use: useFn,
  };
}

export function contextAtomComputedBase<Value>({
  read,
  useContextAtom,
}: {
  read: IJotaiRead<Value>;
  useContextAtom: <Value2>(atomInstance: Atom<Value2>) => [Awaited<Value2>];
}) {
  const atomBuilder = memoizee(() => {
    console.log('create contextAtomComputedBase', Date.now());
    return atom(read);
  });
  const useFn = () => {
    const r = useContextAtom(atomBuilder());
    return r;
  };

  return {
    atom: atomBuilder,
    use: useFn,
  };
}

function globalAtomInContextError<Value>(
  atomInstance: IJotaiAtomProProps<Value>,
) {
  throw new OneKeyLocalError(
    `${atomInstance.name}:::globalAtom cannot be used in context method by get(globalAtom()) or set(globalAtom()), you should use like await globalAtom.get() or await globalAtom.set(...args) instead.`,
  );
}

function contextAtomCustomFn<Value, Args extends unknown[], Result>(
  fn: IJotaiWrite<Args, Result>,
) {
  return (get: IJotaiGetter, set: IJotaiSetter, ...args: Args) => {
    const getNew: IJotaiGetter = ((atomInstance: Atom<Value>) => {
      if (
        (atomInstance as unknown as IJotaiAtomProProps<Value>)
          ?.$$isGlobalAtom === true
      ) {
        globalAtomInContextError(atomInstance as any);
      }
      return get(atomInstance);
    }) as IJotaiGetter;
    const setNew: IJotaiSetter = ((
      atomInstance: WritableAtom<Value, Args, Result>,
      ...args2: Args
    ) => {
      if (
        (atomInstance as unknown as IJotaiAtomProProps<Value>)
          ?.$$isGlobalAtom === true
      ) {
        globalAtomInContextError(atomInstance as any);
      }
      return set(atomInstance, ...args2);
    }) as IJotaiSetter;
    return fn(getNew, setNew, ...args);
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function contextAtomMethodBase<Value, Args extends unknown[], Result>({
  fn,
  useContextAtom,
}: {
  fn: IJotaiWrite<Args, Result>;
  useContextAtom: <Value2, Args2 extends any[], Result2>(
    atomInstance: WritableAtom<Value2, Args2, Result2>,
  ) => [Awaited<Value2>, IJotaiSetAtom<Args2, Result2>];
}) {
  const atomBuilder = memoizee(() => atom(null, contextAtomCustomFn(fn)));
  const useFn = () => {
    const [, setter] = useContextAtom(atomBuilder());
    return setter;
  };

  const call = (set: IJotaiSetter, ...args: Args) =>
    set(atomBuilder(), ...args);

  return {
    atom: atomBuilder,
    use: useFn,
    call,
  };
}
