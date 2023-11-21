import { isNil } from 'lodash';

import { jotaiDefaultStore } from './jotaiDefaultStore';

import type { IJotaiAtomPro, IJotaiWritableAtomPro } from '../types';
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
}
