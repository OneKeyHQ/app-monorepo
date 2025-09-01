import type { MutableRefObject } from 'react';
import {
  createContext,
  createRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from 'react';

import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer as RNNavigationContainer,
} from '@react-navigation/native';
import { useTheme } from 'tamagui';

import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { updateRootViewBackgroundColor } from '@onekeyhq/shared/src/modules3rdParty/rootview-background';
import { navigationIntegration } from '@onekeyhq/shared/src/modules3rdParty/sentry';

import { useSettingConfig } from '../../../hocs/Provider/hooks/useProviderValue';

import type { NavigationContainerRef } from '@react-navigation/native';
import type { GetProps } from 'tamagui';

type IBasicNavigationContainerProps = GetProps<typeof RNNavigationContainer>;
export type INavigationContainerProps = Partial<IBasicNavigationContainerProps>;
export const rootNavigationRef = createRef<NavigationContainerRef<any>>();
// for background open modal
appGlobals.$navigationRef = rootNavigationRef as MutableRefObject<
  NavigationContainerRef<any>
>;

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

const useUpdateRootViewBackgroundColor = (
  color: string,
  theme: 'light' | 'dark',
) => {
  useEffect(() => {
    updateRootViewBackgroundColor(color, theme);
  }, [color, theme]);
};

export function NavigationContainer(props: IBasicNavigationContainerProps) {
  const handleReady = useCallback(() => {
    navigationIntegration.registerNavigationContainer(rootNavigationRef);
  }, []);
  const { theme: themeName } = useSettingConfig();
  const theme = useTheme();

  useUpdateRootViewBackgroundColor(theme.bgApp.val, themeName);

  const themeOptions = useMemo(() => {
    return {
      fonts: DefaultTheme.fonts,
      dark: themeName === 'dark',
      colors: {
        ...(themeName === 'dark' ? DarkTheme : DefaultTheme).colors,
        background: theme.bgApp.val,
        card: theme.bgApp.val,
        border: theme.bgApp.val,
      },
    };
  }, [theme.bgApp.val, themeName]);

  return (
    <RNNavigationContainer
      {...props}
      theme={themeOptions}
      ref={rootNavigationRef}
      onReady={handleReady}
    />
  );
}
