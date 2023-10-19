import type { ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';

import { atom, createStore, useAtom } from 'jotai';

import type { WritableAtom } from 'jotai';

export { atom };

export function createJotaiContext() {
  const Context = createContext<ReturnType<typeof createStore> | null>(null);
  function Provider({ children }: { children?: ReactNode | undefined }) {
    const store = useMemo(() => createStore(), []);
    return <Context.Provider value={store}>{children}</Context.Provider>;
  }
  function useContextAtom<Value, Args extends any[], Result>(
    atomInstance: WritableAtom<Value, Args, Result>,
  ) {
    const store = useContext(Context);
    if (!store) {
      throw new Error('useContextAtom ERROR: store not initialized');
    }
    return useAtom(atomInstance, { store });
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
  return {
    Context,
    Provider,
    withProvider,
    useContextAtom,
  };
}
