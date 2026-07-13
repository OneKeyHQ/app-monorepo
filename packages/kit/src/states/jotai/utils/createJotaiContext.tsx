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
      coldStartCache?: false | undefined;
      coldStartCacheKey?: never;
    }
  | {
      coldStartCache: true;
      coldStartCacheKey: IContextAtomColdStartCacheKey;
    };

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
      const resolvedColdStartScopeKey = (
        s as { __ONEKEY_JOTAI_COLD_START_SCOPE_KEY__?: string }
      ).__ONEKEY_JOTAI_COLD_START_SCOPE_KEY__;
      if (resolvedColdStartScopeKey) {
        hydrateContextColdStartCacheForProvider({
          store: s as any,
          coldStartScopeKey: resolvedColdStartScopeKey,
        });
      }
      return {
        store: s,
        config,
      };
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
    return (
      data.store as
        | (IJotaiContextStore & {
            __ONEKEY_JOTAI_COLD_START_SCOPE_KEY__?: string;
          })
        | undefined
    )?.__ONEKEY_JOTAI_COLD_START_SCOPE_KEY__;
  }

  function contextAtom<Value>(
    initialValue: Value,
    options?: IContextAtomOptions,
  ) {
    return contextAtomBase({
      useContextAtom,
      initialValue,
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
