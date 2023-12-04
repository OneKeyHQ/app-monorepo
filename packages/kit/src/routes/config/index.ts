/* eslint-disable @typescript-eslint/no-unsafe-call */
import { useMemo } from 'react';

import { getPathFromState as getPathFromStateDefault } from '@react-navigation/core';

import type {
  ICommonNavigatorConfig,
  INavigationContainerProps,
  ITabNavigatorExtraConfig,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { getExtensionIndexHtml } from '@onekeyhq/shared/src/utils/extUtils';

import { ERootRoutes } from '../enum';
import { rootRouter } from '../router';

import { allowList, routerPrefix } from './allowList';
import { registerDeepLinking } from './deeplink';

import type { LinkingOptions } from '@react-navigation/native';

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

const REWRITE_PREFIX = 'REWRITE--';

const resolveScreens = (routes: typeof rootRouter) =>
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  routes // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    ? routes.reduce(
        (prev, route) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          prev[route.name] = {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            path: route.rewrite
              ? `${REWRITE_PREFIX}/${route.rewrite}`
              : route.rewrite || route.name,
          };
          const config = pickConfig(route);
          if (config) {
            prev[route.name].screens = resolveScreens(config);
          }
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return prev;
        },
        {} as Record<
          string,
          {
            path: string;
            screens?: Record<
              string,
              { path: string; screens?: Record<string, { path: string }> }
            >;
          }
        >,
      )
    : undefined;

const buildLinking = (routes: typeof rootRouter): LinkingOptions<any> => {
  const screenHierarchyConfig = resolveScreens(routes);
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
      let newPath = rule?.showParams ? defaultPath : defaultPathWithoutQuery;

      if (defaultPath.includes(REWRITE_PREFIX)) {
        newPath = defaultPath.split(REWRITE_PREFIX).pop() || '/';
      }
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

export const useRouterConfig = () =>
  useMemo(() => {
    // Execute it before component mount.
    registerDeepLinking();
    return {
      routerConfig: rootRouter,
      containerProps: platformEnv.isRuntimeBrowser
        ? ({
            documentTitle: {
              formatter: () => 'OneKey',
            },
            linking: buildLinking(rootRouter),
          } as INavigationContainerProps)
        : undefined,
    };
  }, []);
