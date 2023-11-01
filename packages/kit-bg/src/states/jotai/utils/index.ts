/* eslint-disable camelcase */
import { atom, useAtom } from 'jotai';
import { RESET } from 'jotai/utils';

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
  IWritableAtomPro,
  Read,
  SetAtom,
  WithInitialValue,
  Write,
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
  baseAtom.initialValue = initialValue;
  const proAtom = wrapAtomPro(name as EAtomNames, baseAtom);
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
  const initialValue0 = initialValue!; // as Value | typeof RESET;
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
