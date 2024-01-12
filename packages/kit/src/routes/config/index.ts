/* eslint-disable @typescript-eslint/no-unsafe-call */
import { useMemo } from 'react';

import { getPathFromState as getPathFromStateDefault } from '@react-navigation/core';
import { createURL } from 'expo-linking';

import {
  type ICommonNavigatorConfig,
  type INavigationContainerProps,
  type ITabNavigatorExtraConfig,
  useRouterEventsRef,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { getExtensionIndexHtml } from '@onekeyhq/shared/src/utils/extUtils';

import { ERootRoutes } from '../enum';
import { rootRouter } from '../router';

import { buildAllowList } from './allowList';
import { registerDeepLinking } from './deeplink';

import type { IScreenPathConfig } from './allowList';
import type { LinkingOptions } from '@react-navigation/native';

const routerPrefix = createURL('/');
const rootRouteValues = Object.values(ERootRoutes);
const pickConfig = (
  routeConfig: ICommonNavigatorConfig<any, any> | ITabNavigatorExtraConfig<any>,
) => {
  if (Array.isArray((routeConfig as ITabNavigatorExtraConfig<any>).children)) {
    return (routeConfig as ITabNavigatorExtraConfig<any>).children;
  }
  const { component, name } = routeConfig as ICommonNavigatorConfig<any, any>;

  if (rootRouteValues.includes(name) && typeof component === 'function') {
    const result: any = (component as () => JSX.Element)();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return result?.props?.config as typeof rootRouter;
  }
};

const resolveScreens = (routes: typeof rootRouter) =>
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  routes // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    ? routes.reduce((prev, route) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        prev[route.name] = {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          path: route.rewrite ? route.rewrite : route.name,
          exact: !!route.exact,
        };
        const config = pickConfig(route);
        if (config) {
          prev[route.name].screens = resolveScreens(config);
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return prev;
      }, {} as IScreenPathConfig)
    : undefined;

const buildLinking = (routes: typeof rootRouter): LinkingOptions<any> => {
  const screenHierarchyConfig = resolveScreens(routes);
  if (!screenHierarchyConfig) {
    return { prefixes: [routerPrefix] };
  }
  const allowList = buildAllowList(screenHierarchyConfig);
  return {
    enabled: true,
    prefixes: [routerPrefix],

    /**
     * Only change url at whitelist routes, or return home page
     */
    getPathFromState(state, options) {
      const extHtmlFileUrl = `/${getExtensionIndexHtml()}`;
      /**
       * firefox route issue, refresh cannot recognize hash, just redirect to home page after refresh.
       */
      if (platformEnv.isExtFirefox) {
        return extHtmlFileUrl;
      }
      const defaultPath = getPathFromStateDefault(state, options);
      const defaultPathWithoutQuery = defaultPath.split('?')[0] || '';
      const rule = allowList[defaultPathWithoutQuery];
      const newPath = rule?.showParams ? defaultPath : defaultPathWithoutQuery;
      // keep manifest v3 url with html file
      if (platformEnv.isExtChrome && platformEnv.isManifestV3) {
        /*
        check chrome.webRequest.onBeforeRequest
         /ui-expand-tab.html/#/   not working for Windows Chrome
         /ui-expand-tab.html#/    works fine
        */
        return `${extHtmlFileUrl}#${newPath}`;
      }
      return newPath;
    },
    config: {
      initialRouteName: ERootRoutes.Main,
      screens: {
        ...screenHierarchyConfig,
        // custom route with path params needs to be defined at last
        NotFound: '*',
      },
    },
  };
};

export const useRouterConfig = () => {
  const routerRef = useRouterEventsRef();
  return useMemo(() => {
    // Execute it before component mount.
    registerDeepLinking();
    return {
      routerConfig: rootRouter,
      containerProps: {
        documentTitle: {
          formatter: () => 'OneKey',
        },
        onStateChange: (state) => {
          routerRef.current.forEach((cb) => cb?.(state));
        },
        linking: buildLinking(rootRouter),
      } as INavigationContainerProps,
    };
  }, [routerRef]);
};
