import { RESET } from 'jotai/utils';

import type { Atom, WritableAtom } from 'jotai';
import type {
  AsyncStorage,
  SyncStorage,
} from 'jotai/vanilla/utils/atomWithStorage';

export { AsyncStorage, Atom, RESET, SyncStorage, WritableAtom };

export type Unsubscribe = () => void;

export type WithInitialValue<Value> = {
  init: Value;
};

export type SetStateActionWithReset<Value> =
  | Value
  | typeof RESET
  | ((prev: Value) => Value | typeof RESET);

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
