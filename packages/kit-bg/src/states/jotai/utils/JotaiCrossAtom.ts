import { isEqual, isNil } from 'lodash';

import { jotaiDefaultStore } from './jotaiDefaultStore';
import {
  beginOptimisticAtomWrite,
  settleOptimisticAtomWrite,
} from './optimisticAtomWrites';
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

type IOptimisticWritableAtom<AtomValue> = IJotaiWritableAtomPro<
  AtomValue,
  [update: AtomValue | IJotaiAtomSetWithoutProxy],
  unknown
>;

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
  // value the UI already knows. While the forward is in flight, bg echoes of
  // older writes are dropped (see `optimisticAtomWrites`); if bg rejects the
  // write, the UI goes back to the last value bg accepted and the error is
  // rethrown.
  setOptimistic = async <AtomValue extends ExtractAtomValue<ReturnType<T>>>(
    value: AtomValue,
  ) => {
    const a = (await this.ready()) as IOptimisticWritableAtom<AtomValue>;
    if (!shouldProxyAtomUpdateFromUiToBg()) {
      return jotaiDefaultStore.set(a, value);
    }
    const seq = beginOptimisticAtomWrite({
      name: this.name,
      value,
      currentValue: await this.readSettledValue(a),
    });
    await this.setWithoutProxy(a, value);
    try {
      const result = await jotaiDefaultStore.set(a, value);
      await this.reconcileOptimisticWrite(a, seq, true);
      return result;
    } catch (error) {
      await this.reconcileOptimisticWrite(a, seq, false);
      throw error;
    }
  };

  sub = (callback: () => void): (() => void) => {
    const a = this.atom();
    return jotaiDefaultStore.sub(a, callback);
  };

  private readSettledValue = async <AtomValue>(
    a: IOptimisticWritableAtom<AtomValue>,
  ): Promise<unknown> => {
    const current: unknown = jotaiDefaultStore.get(a);
    if (current instanceof Promise) {
      return (current as Promise<unknown>).then((settled) => settled);
    }
    return current;
  };

  private setWithoutProxy = <AtomValue>(
    a: IOptimisticWritableAtom<AtomValue>,
    value: unknown,
  ) => {
    const localUpdate: IJotaiAtomSetWithoutProxy = {
      $$isForceSetAtomWithoutProxy: true,
      name: this.name,
      payload: value,
    };
    return jotaiDefaultStore.set(a, localUpdate);
  };

  // After a forward settles, the UI should show the newest write still in
  // flight, or the last value bg accepted when nothing is pending. That is
  // already the case unless a write was rejected, so this is a no-op on the
  // happy path.
  private reconcileOptimisticWrite = async <AtomValue>(
    a: IOptimisticWritableAtom<AtomValue>,
    seq: number,
    resolved: boolean,
  ) => {
    const settled = settleOptimisticAtomWrite({
      name: this.name,
      seq,
      resolved,
    });
    if (!settled) {
      return;
    }
    const current = await this.readSettledValue(a);
    if (isEqual(current, settled.expectedValue)) {
      return;
    }
    await this.setWithoutProxy(a, settled.expectedValue);
  };
}
