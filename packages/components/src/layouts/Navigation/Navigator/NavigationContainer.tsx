import type { MutableRefObject } from 'react';
import {
  createContext,
  createRef,
  useCallback,
  useContext,
  useEffect,
} from 'react';

import { NavigationContainer as RNNavigationContainer } from '@react-navigation/native';

import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { navigationIntegration } from '@onekeyhq/shared/src/modules3rdParty/sentry';

import type { NavigationContainerRef } from '@react-navigation/native';
import type { GetProps } from 'tamagui';

type IBasicNavigationContainerProps = GetProps<typeof RNNavigationContainer>;
export type INavigationContainerProps = Partial<IBasicNavigationContainerProps>;
export const rootNavigationRef = createRef<NavigationContainerRef<any>>();

// for background open modal
appGlobals.$navigationRef = rootNavigationRef;

export type IRouterChangeEvent = INavigationContainerProps['onStateChange'];
const RouterEventContext = createContext<
  MutableRefObject<IRouterChangeEvent[]>
>({
  current: [],
});

export const useRouterEventsRef = () => useContext(RouterEventContext);
export const RouterEventProvider = RouterEventContext.Provider;

export const useOnRouterChange = (callback: IRouterChangeEvent) => {
  const routerRef = useContext(RouterEventContext);
  useEffect(() => {
    routerRef.current.push(callback);
    if (rootNavigationRef.current) {
      callback?.(rootNavigationRef.current?.getState());
    }
    return () => {
      routerRef.current = routerRef.current.filter((i) => i !== callback);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};

export function NavigationContainer(props: IBasicNavigationContainerProps) {
  const handleReady = useCallback(() => {
    navigationIntegration.registerNavigationContainer(rootNavigationRef);
  }, []);
  return (
    <RNNavigationContainer
      {...props}
      ref={rootNavigationRef}
      onReady={handleReady}
    />
  );
}
