import type { ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';

// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { atom, createStore, useAtom } from 'jotai';

import type {
  IJotaiRead,
  IJotaiWrite,
} from '@onekeyhq/kit-bg/src/states/jotai/types';
import {
  contextAtomBase,
  contextAtomComputedBase,
  contextAtomMethodBase,
  hydrateContextColdStartCacheForProvider,
} from '@onekeyhq/kit-bg/src/states/jotai/utils';
import type { IContextAtomColdStartCacheKey } from '@onekeyhq/shared/src/consts/jotaiConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { WritableAtom } from 'jotai';

export { atom };

export type IJotaiContextStore = ReturnType<typeof createStore>;
type IContextAtomOptions =
  | {
      name?: string;
      coldStartCache?: false | undefined;
      coldStartCacheKey?: never;
    }
  | {
      name?: string;
      coldStartCache: true;
      coldStartCacheKey: IContextAtomColdStartCacheKey;
    };

export function createJotaiContext<TContextConfig = undefined>() {
  const Context = createContext<{
    store: IJotaiContextStore | undefined;
    config: TContextConfig | undefined;
    coldStartScopeKey: string | undefined;
  }>({ store: undefined, config: undefined, coldStartScopeKey: undefined });

  function Provider({
    config,
    store,
    coldStartScopeKey,
    children,
  }: {
    config?: TContextConfig;
    store?: IJotaiContextStore;
    coldStartScopeKey?: string;
    children?: ReactNode | undefined;
  }) {
    const value = useMemo(() => {
      const s = store || createStore();
      const resolvedColdStartScopeKey =
        coldStartScopeKey ||
        (s as { __ONEKEY_JOTAI_COLD_START_SCOPE_KEY__?: string })
          .__ONEKEY_JOTAI_COLD_START_SCOPE_KEY__;
      hydrateContextColdStartCacheForProvider({
        store: s as any,
        coldStartScopeKey: resolvedColdStartScopeKey,
      });
      return {
        store: s,
        config,
        coldStartScopeKey: resolvedColdStartScopeKey,
      };
    }, [store, config, coldStartScopeKey]);
    return <Context.Provider value={value}>{children}</Context.Provider>;
  }
  function withProvider<P>(WrappedComponent: React.ComponentType<P>) {
    return function WithProvider(
      props: P,
      {
        store,
        config,
        coldStartScopeKey,
      }: {
        config?: TContextConfig;
        store?: IJotaiContextStore;
        coldStartScopeKey?: string;
      } = {},
    ) {
      return (
        <Provider
          store={store}
          config={config}
          coldStartScopeKey={coldStartScopeKey}
        >
          <WrappedComponent {...(props as any)} />
        </Provider>
      );
    };
  }

  function useContextData() {
    const data = useContext(Context);
    if (!data?.store) {
      throw new OneKeyLocalError(
        'useContextStore ERROR: store not initialized',
      );
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
  function useColdStartScopeKey() {
    const data = useContextData();
    return data.coldStartScopeKey;
  }

  function contextAtom<Value>(
    initialValue: Value,
    options?: IContextAtomOptions,
  ) {
    return contextAtomBase({
      useContextAtom,
      initialValue,
      name: options?.name,
      coldStartCache: options?.coldStartCache,
      coldStartCacheKey: options?.coldStartCacheKey,
      useColdStartScopeKey,
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
