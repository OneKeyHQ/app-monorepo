import type { MutableRefObject, RefObject } from 'react';
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
import { useMMKVDevTools } from '@rozenite/mmkv-plugin';
import { useNetworkActivityDevTools } from '@rozenite/network-activity-plugin';
import { useReactNavigationDevTools } from '@rozenite/react-navigation-plugin';

import { useIsTabletMainView } from '@onekeyhq/components/src/hooks/useTabletMode';
import { useTheme } from '@onekeyhq/components/src/shared/tamagui';
import type { GetProps } from '@onekeyhq/components/src/shared/tamagui';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { updateRootViewBackgroundColor } from '@onekeyhq/shared/src/modules3rdParty/rootview-background';
import { navigationIntegration } from '@onekeyhq/shared/src/modules3rdParty/sentry';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  ETabRoutes,
  ITabStackParamList,
} from '@onekeyhq/shared/src/routes';
import { ERootRoutes } from '@onekeyhq/shared/src/routes';
import mmkvStorageInstance from '@onekeyhq/shared/src/storage/instance/mmkvStorageInstance';

import { useSettingConfig } from '../../../hocs/Provider/hooks/useProviderValue';

import type { NavigationContainerRef } from '@react-navigation/native';

type IBasicNavigationContainerProps = GetProps<typeof RNNavigationContainer>;
export type INavigationContainerProps = Partial<IBasicNavigationContainerProps>;

export const tabletMainViewNavigationRef =
  createRef<NavigationContainerRef<any>>();
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

const useNativeDevTools =
  platformEnv.isNative && platformEnv.isDev
    ? ({ ref }: { ref: RefObject<NavigationContainerRef<any>> }) => {
        useReactNavigationDevTools({ ref });
        useNetworkActivityDevTools();
        useMMKVDevTools({
          storages: [mmkvStorageInstance],
        });
      }
    : () => {};

export function NavigationContainer(props: IBasicNavigationContainerProps) {
  const isTabletMainView = useIsTabletMainView();
  const handleReady = useCallback(() => {
    navigationIntegration.registerNavigationContainer(
      isTabletMainView ? tabletMainViewNavigationRef : rootNavigationRef,
    );
  }, [isTabletMainView]);
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

  useNativeDevTools({
    ref: rootNavigationRef as RefObject<NavigationContainerRef<any>>,
  });

  return (
    <RNNavigationContainer
      {...props}
      theme={themeOptions}
      ref={isTabletMainView ? tabletMainViewNavigationRef : rootNavigationRef}
      onReady={handleReady}
    />
  );
}

export const switchTab = <T extends ETabRoutes>(
  route: T,
  params?: {
    screen: keyof ITabStackParamList[T];
    params?: ITabStackParamList[T][keyof ITabStackParamList[T]];
  },
) => {
  setTimeout(() => {
    tabletMainViewNavigationRef.current?.navigate(
      ERootRoutes.Main,
      {
        screen: route,
        params,
      },
      {
        pop: true,
      },
    );
  });
  rootNavigationRef.current?.navigate(ERootRoutes.Main, {
    screen: route,
    params,
  });
};
