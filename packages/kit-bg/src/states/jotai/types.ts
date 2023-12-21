import { RESET } from 'jotai/utils';

import type { Atom, WritableAtom } from 'jotai';
import type {
  AsyncStorage,
  SyncStorage,
} from 'jotai/vanilla/utils/atomWithStorage';

export const JOTAI_RESET = RESET as unknown as any | typeof RESET;
export { AsyncStorage, Atom, SyncStorage, WritableAtom };

export type IJotaiUnsubscribe = () => void;

export type IJotaiWithInitialValue<Value> = {
  init: Value;
};

export type IJotaiSetStateActionWithReset<Value> =
  | Value
  | typeof JOTAI_RESET
  | ((prev: Value) => Value | typeof JOTAI_RESET);

export type IJotaiGetter = <Value>(atom: Atom<Value>) => Value;
export type IJotaiSetter = <Value, Args extends unknown[], Result>(
  atom: WritableAtom<Value, Args, Result>,
  ...args: Args
) => Result;

export type IJotaiRead<Value, SetSelf = never> = (
  get: IJotaiGetter,
  options: {
    readonly signal: AbortSignal;
    readonly setSelf: SetSelf;
  },
) => Value;

export type IJotaiSetAtom<Args extends unknown[], Result> = <A extends Args>(
  ...args: A
) => Result;

export type IJotaiWrite<Args extends unknown[], Result> = (
  get: IJotaiGetter,
  set: IJotaiSetter,
  ...args: Args
) => Result;

type IJotaiAtomProProps<Value> = {
  initialValue: Value;
  storageReady: Promise<boolean>;
  persist: boolean;
};
export type IJotaiAtomPro<Value> = Atom<Value> & IJotaiAtomProProps<Value>;
export type IJotaiWritableAtomPro<
  Value,
  Args extends unknown[],
  Result,
> = WritableAtom<Value, Args, Result> & IJotaiAtomProProps<Value>;
export type IJotaiAtomSetWithoutProxy = {
  $$isForceSetAtomWithoutProxy: true;
  name: string;
  payload: any;
};
