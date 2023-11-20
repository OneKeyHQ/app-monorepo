/* eslint-disable camelcase */
import { atom, useAtom } from 'jotai';

import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

// import { jotaiBgSync } from './jotaiBgSync';
import {
  atomWithStorage,
  globalJotaiStorageReadyHandler,
} from '../jotaiStorage';

import { JotaiCrossAtom } from './JotaiCrossAtom';
import { wrapAtomPro } from './wrapAtomPro';

import type { EAtomNames } from '../atomNames';
import type {
  IJotaiRead,
  IJotaiSetAtom,
  IJotaiSetter,
  IJotaiWithInitialValue,
  IJotaiWritableAtomPro,
  IJotaiWrite,
} from '../types';
import type { Atom, PrimitiveAtom, WritableAtom } from 'jotai';

export function makeCrossAtom<T extends () => any>(name: string, fn: T) {
  const atomBuilder = memoizee(fn, {
    primitive: true,
    normalizer: () => '',
  });

  return {
    target: new JotaiCrossAtom(name, atomBuilder),
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
  read: IJotaiRead<Value>;
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
  write: IJotaiWrite<Args, Result>;
  //
  initialValue?: Value;
  read?: undefined;
  storageName?: string;
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
  read?: IJotaiRead<Value, IJotaiSetAtom<Args, Result>> | IJotaiRead<Value>;
  write?: IJotaiWrite<Args, Result>;
}) {
  let a = null;
  let persist = false;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const initialVal = Object.freeze(initialValue!);
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
  throw new Error('write or read is missing');
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

export function contextAtomBase<Value>({
  initialValue,
  useContextAtom,
}: {
  initialValue: Value;
  useContextAtom: <Value2, Args extends any[], Result>(
    atomInstance: WritableAtom<Value2, Args, Result>,
  ) => [Awaited<Value2>, IJotaiSetAtom<Args, Result>];
}) {
  const atomBuilder = memoizee(() => atom(initialValue));
  const useFn = () => useContextAtom(atomBuilder());

  return {
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
  const atomBuilder = memoizee(() => atom(null, fn));
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
