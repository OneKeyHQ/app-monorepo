import { isNil } from 'lodash';

import { jotaiDefaultStore } from './jotaiDefaultStore';
import { shouldProxyAtomUpdateFromUiToBg } from './wrapAtomPro';

import type {
  IJotaiAtomPro,
  IJotaiAtomSetWithoutProxy,
  IJotaiWritableAtomPro,
} from '../types';
import type {
  ExtractAtomArgs,
  ExtractAtomResult,
  ExtractAtomValue,
} from 'jotai/vanilla';

export class JotaiCrossAtom<T extends () => any> {
  constructor(name: string, atomBuilder: T) {
    this.name = name;
    this.atom = atomBuilder;
  }

  name: string;

  atom: T;

  ready = async () => {
    const a = this.atom() as IJotaiAtomPro<ExtractAtomValue<ReturnType<T>>>;
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
    const a = (await this.ready()) as IJotaiWritableAtomPro<
      AtomValue,
      Args,
      Result
    >;
    return jotaiDefaultStore.set(a, ...args);
  };

  // Apply `value` on this UI runtime first, then forward it to bg. A plain
  // `set` on a split runtime only proxies the write and the UI repaints when
  // the bg echo comes back, so any bg backlog (all-networks refresh on
  // Android) shows up as input lag. Only for user-initiated writes whose next
  // value the UI already knows; the bg echo then lands as an equal no-op.
  setOptimistic = async <AtomValue extends ExtractAtomValue<ReturnType<T>>>(
    value: AtomValue,
  ) => {
    const a = (await this.ready()) as IJotaiWritableAtomPro<
      AtomValue,
      [update: AtomValue | IJotaiAtomSetWithoutProxy],
      unknown
    >;
    if (!shouldProxyAtomUpdateFromUiToBg()) {
      return jotaiDefaultStore.set(a, value);
    }
    const localUpdate: IJotaiAtomSetWithoutProxy = {
      $$isForceSetAtomWithoutProxy: true,
      name: this.name,
      payload: value,
    };
    await jotaiDefaultStore.set(a, localUpdate);
    return jotaiDefaultStore.set(a, value);
  };

  sub = (callback: () => void): (() => void) => {
    const a = this.atom();
    return jotaiDefaultStore.sub(a, callback);
  };
}
