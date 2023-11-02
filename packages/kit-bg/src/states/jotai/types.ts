import { RESET } from 'jotai/utils';

import type { Atom, WritableAtom } from 'jotai';
import type {
  AsyncStorage,
  SyncStorage,
} from 'jotai/vanilla/utils/atomWithStorage';

export const JOTAI_RESET = RESET as unknown as any | typeof RESET;
export { AsyncStorage, Atom, SyncStorage, WritableAtom };

export type Unsubscribe = () => void;

export type WithInitialValue<Value> = {
  init: Value;
};

export type SetStateActionWithReset<Value> =
  | Value
  | typeof JOTAI_RESET
  | ((prev: Value) => Value | typeof JOTAI_RESET);

export type Getter = <Value>(atom: Atom<Value>) => Value;
export type Setter = <Value, Args extends unknown[], Result>(
  atom: WritableAtom<Value, Args, Result>,
  ...args: Args
) => Result;

export type Read<Value, SetSelf = never> = (
  get: Getter,
  options: {
    readonly signal: AbortSignal;
    readonly setSelf: SetSelf;
  },
) => Value;

export type SetAtom<Args extends unknown[], Result> = <A extends Args>(
  ...args: A
) => Result;

export type Write<Args extends unknown[], Result> = (
  get: Getter,
  set: Setter,
  ...args: Args
) => Result;

type IAtomProProps<Value> = {
  initialValue: Value;
  storageReady: Promise<boolean>;
  persist: boolean;
};
export type IAtomPro<Value> = Atom<Value> & IAtomProProps<Value>;
export type IWritableAtomPro<
  Value,
  Args extends unknown[],
  Result,
> = WritableAtom<Value, Args, Result> & IAtomProProps<Value>;
export type IAtomSetWithoutProxy = {
  $$isForceSetAtomWithoutProxy: true;
  name: string;
  payload: any;
};
