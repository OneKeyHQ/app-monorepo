import type { ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';

import { atom, createStore, useAtom } from 'jotai';

import type {
  IJotaiRead,
  IJotaiWrite,
} from '@onekeyhq/kit-bg/src/states/jotai/types';
import {
  contextAtomBase,
  contextAtomComputedBase,
  contextAtomMethodBase,
} from '@onekeyhq/kit-bg/src/states/jotai/utils';

import type { WritableAtom } from 'jotai';

export { atom };

export function createJotaiContext(options?: { isSingletonStore?: boolean }) {
  const Context = createContext<ReturnType<typeof createStore> | null>(null);
  let store: ReturnType<typeof createStore> | null = null;
  if (options?.isSingletonStore) {
    store = createStore();
  }
  function Provider({ children }: { children?: ReactNode | undefined }) {
    const innerStore = useMemo(
      () => (options?.isSingletonStore ? store : createStore()),
      [],
    );
    return <Context.Provider value={innerStore}>{children}</Context.Provider>;
  }
  function useContextAtom<Value, Args extends any[], Result>(
    atomInstance: WritableAtom<Value, Args, Result>,
  ) {
    const $store = useContext(Context);
    if (!$store) {
      throw new Error('useContextAtom ERROR: store not initialized');
    }
    return useAtom(atomInstance, { store: $store });
  }
  function withProvider<P>(WrappedComponent: React.ComponentType<P>) {
    return function WithProvider(props: P) {
      return (
        <Provider>
          <WrappedComponent {...(props as any)} />
        </Provider>
      );
    };
  }

  function contextAtom<Value>(initialValue: Value) {
    return contextAtomBase({
      useContextAtom,
      initialValue,
    });
  }

  function contextAtomComputed<Value>(read: IJotaiRead<Value>) {
    return contextAtomComputedBase({
      useContextAtom: useContextAtom as any,
      read,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function contextAtomMethod<Value, Args extends unknown[], Result>(
    fn: IJotaiWrite<Args, Result>,
  ) {
    return contextAtomMethodBase({
      useContextAtom,
      fn,
    });
  }

  return {
    Context,
    Provider,
    withProvider,
    useContextAtom,
    contextAtom,
    contextAtomMethod,
    contextAtomComputed,
    store,
  };
}
