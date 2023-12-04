/* eslint-disable @typescript-eslint/no-unsafe-call */
import { useMemo } from 'react';

import { getPathFromState as getPathFromStateDefault } from '@react-navigation/core';
import * as Linking from 'expo-linking';

import type {
  type ICommonNavigatorConfig,
  INavigationContainerProps,
  type ITabNavigatorExtraConfig,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { getExtensionIndexHtml } from '@onekeyhq/shared/src/utils/extUtils';

import { ERootRoutes } from '../enum';
import { rootRouter } from '../router';

import { allowList } from './allowList';
import { registerDeepLinking } from './deeplink';

import type { LinkingOptions } from '@react-navigation/native';

const prefix = Linking.createURL('/');

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
  // const screenHierarchyConfig =
  //   generateScreenHierarchyRouteConfigList(allowList);
  const screenHierarchyConfig = resolveScreens(routes);
  console.log('screenHierarchyConfig', screenHierarchyConfig);
  return {
    enabled: true,
    prefixes: [prefix],

    /**
     * Only change url at whitelist routes, or return home page
     */
    getPathFromState(state, options) {
      console.log('getPathFromState-', state, options);
      const extHtmlFileUrl = `/${getExtensionIndexHtml()}`;
      /**
       * firefox route issue, refresh cannot recognize hash, just redirect to home page after refresh.
       */
      if (platformEnv.isExtFirefox) {
        return extHtmlFileUrl;
      }
      let newPath = '/';
      const defaultPath = getPathFromStateDefault(state, options);
      const defaultPathWithoutQuery = defaultPath.split('?')[0] || '';
      console.log(
        'getPathFromState-defaultPath',
        defaultPath,
        defaultPathWithoutQuery,
      );
      const rule = allowList.find(
        (item) => item.path === defaultPathWithoutQuery,
      );
      console.log('allowList', allowList, rule);
      console.log('rule===', rule);
      newPath = rule?.showParams ? defaultPath : defaultPathWithoutQuery;
      if (defaultPath.includes('NOOO_PATH')) {
        return newPath;
      }

      if (defaultPath.includes('REWRITE--')) {
        newPath = defaultPath.split('REWRITE--').pop() || '/';
      }
      console.log('REWRITE', newPath);
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
          } as unknown as INavigationContainerProps)
        : undefined,
    };
  }, []);
