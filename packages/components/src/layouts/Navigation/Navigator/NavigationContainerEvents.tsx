import {
  createContext,
  createRef,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import type { MutableRefObject } from 'react';

import appGlobals from '@onekeyhq/shared/src/appGlobals';

import { useSplitMainView } from '../../../hooks/useSplitView';

import type {
  NavigationContainerRef,
  NavigationState,
} from '@react-navigation/native';

export type IRouterState = Readonly<NavigationState> | undefined;
export type IRouterChangeEvent = (state: IRouterState) => void;

export type IRouterEventStore = {
  listeners: Set<IRouterChangeEvent>;
  isReady: boolean;
  currentState: IRouterState;
};

export const tabletMainViewNavigationRef =
  createRef<NavigationContainerRef<any>>();
export const rootNavigationRef = createRef<NavigationContainerRef<any>>();

appGlobals.$navigationRef = rootNavigationRef as MutableRefObject<
  NavigationContainerRef<any>
>;
appGlobals.$tabletMainViewNavigationRef =
  tabletMainViewNavigationRef as MutableRefObject<NavigationContainerRef<any>>;

export function createRouterEventStore(): IRouterEventStore {
  return {
    listeners: new Set(),
    isReady: false,
    currentState: undefined,
  };
}

const RouterEventContext = createContext<IRouterEventStore>(
  createRouterEventStore(),
);

export const RouterEventProvider = RouterEventContext.Provider;

export function useRouterEventStore() {
  return useContext(RouterEventContext);
}

export function useCurrentNavigationRef() {
  return useSplitMainView() ? tabletMainViewNavigationRef : rootNavigationRef;
}

function broadcastRouterState(store: IRouterEventStore) {
  store.listeners.forEach((listener) => listener(store.currentState));
}

export function markRouterEventStoreReady(
  store: IRouterEventStore,
  state: Exclude<IRouterState, undefined>,
) {
  if (store.isReady) {
    return;
  }
  store.currentState = state;
  store.isReady = true;
  broadcastRouterState(store);
}

export function publishRouterStateChange(
  store: IRouterEventStore,
  state: IRouterState,
) {
  store.currentState = state;
  if (store.isReady) {
    broadcastRouterState(store);
  }
}

export function useRouterContainerEventHandlers() {
  const store = useRouterEventStore();
  const navigationRef = useCurrentNavigationRef();

  return useMemo(
    () => ({
      onReady: () => {
        const state = navigationRef.current?.getRootState();
        if (state) {
          markRouterEventStoreReady(store, state);
        }
      },
      onStateChange: (state: IRouterState) => {
        if (!store.isReady && state !== undefined) {
          markRouterEventStoreReady(store, state);
          return;
        }
        publishRouterStateChange(store, state);
      },
    }),
    [navigationRef, store],
  );
}

export function useOnRouterChange(callback: IRouterChangeEvent) {
  const store = useRouterEventStore();
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const listener: IRouterChangeEvent = (state) => {
      callbackRef.current(state);
    };
    store.listeners.add(listener);
    if (store.isReady) {
      listener(store.currentState);
    }
    return () => {
      store.listeners.delete(listener);
    };
  }, [store]);
}
