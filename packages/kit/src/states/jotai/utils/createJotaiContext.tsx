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

export type IJotaiContextStore = ReturnType<typeof createStore>;

export function createJotaiContext<TContextConfig = undefined>() {
  const Context = createContext<{
    store: IJotaiContextStore | undefined;
    config: TContextConfig | undefined;
  }>({ store: undefined, config: undefined });

  function Provider({
    config,
    store,
    children,
  }: {
    config?: TContextConfig;
    store?: IJotaiContextStore;
    children?: ReactNode | undefined;
  }) {
    const value = useMemo(() => {
      const s = store || createStore();
      return { store: s, config };
    }, [store, config]);
    return <Context.Provider value={value}>{children}</Context.Provider>;
  }
  function withProvider<P>(WrappedComponent: React.ComponentType<P>) {
    return function WithProvider(
      props: P,
      {
        store,
        config,
      }: {
        config?: TContextConfig;
        store?: IJotaiContextStore;
      } = {},
    ) {
      return (
        <Provider store={store} config={config}>
          <WrappedComponent {...(props as any)} />
        </Provider>
      );
    };
  }

  function useContextData() {
    const data = useContext(Context);
    if (!data?.store) {
      throw new Error('useContextStore ERROR: store not initialized');
    }
    return data;
  }
  function useContextAtom<Value, Args extends any[], Result>(
    atomInstance: WritableAtom<Value, Args, Result>,
  ) {
    const data = useContextData();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return useAtom(atomInstance, { store: data.store! });
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
    useContextData,
    contextAtom,
    contextAtomMethod,
    contextAtomComputed,
  };
}
