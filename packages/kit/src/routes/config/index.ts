/* eslint-disable @typescript-eslint/no-unsafe-call */
import { useMemo } from 'react';

import { getPathFromState as getPathFromStateDefault } from '@react-navigation/core';
import { createURL } from 'expo-linking';

import {
  type INavigationContainerProps,
  rootNavigationRef,
  useRouterEventsRef,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ERootRoutes } from '@onekeyhq/shared/src/routes';
import { getExtensionIndexHtml } from '@onekeyhq/shared/src/utils/extUtils';
import type { IScreenPathConfig } from '@onekeyhq/shared/src/utils/routeUtils';
import { buildAllowList } from '@onekeyhq/shared/src/utils/routeUtils';

import { rootRouter, useRootRouter } from '../router';

import { registerDeepLinking } from './deeplink';
import { getStateFromPath } from './getStateFromPath';

import type { LinkingOptions } from '@react-navigation/native';

const routerPrefix = createURL('/');

interface IScreenRouterConfig {
  name: string;
  rewrite?: string;
  exact?: boolean;
  children?: IScreenRouterConfig[];
}

const resolveScreens = (routes: IScreenRouterConfig[]) =>
  routes
    ? routes.reduce((prev, route) => {
        prev[route.name] = {
          path: route.rewrite ? route.rewrite : route.name,
          exact: !!route.exact,
        };
        const config = Array.isArray(route.children)
          ? route.children
          : undefined;
        if (config) {
          prev[route.name].screens = resolveScreens(config);
        }

        return prev;
      }, {} as IScreenPathConfig)
    : undefined;
const extHtmlFileUrl = `/${getExtensionIndexHtml()}`;
const ROOT_PATH = platformEnv.isExtension ? `${extHtmlFileUrl}#/` : '/';

const MODAL_PATH = `/${ERootRoutes.Modal}`;
const FULL_SCREEN_MODAL_PATH = `/${ERootRoutes.iOSFullScreen}`;

const onGetStateFromPath = platformEnv.isExtension
  ? (((path, options) => {
      const state = getStateFromPath(path, options);
      const prevState = rootNavigationRef.current?.getRootState();
      // Keep the "main" router from re-rendering.
      if (state && prevState) {
        // @ts-expect-error
        state.key = prevState?.key;
        // @ts-expect-error
        state.routes[0] = prevState?.routes[0];
      }
      return state;
    }) as typeof getStateFromPath)
  : getStateFromPath;

const useBuildLinking = (): LinkingOptions<any> => {
  const routes = useRootRouter();
  const screenHierarchyConfig = resolveScreens(routes);
  if (!screenHierarchyConfig) {
    return { prefixes: [routerPrefix] };
  }
  const allowList = buildAllowList(screenHierarchyConfig);
  const allowListKeys = Object.keys(allowList);
  return {
    enabled: true,

    // ****** Dangerously, DO NOT add any prefix here, it will expose all route url to deeplink ******
    // prefixes: [routerPrefix, ONEKEY_APP_DEEP_LINK, WALLET_CONNECT_DEEP_LINK],
    prefixes: [],

    getStateFromPath: onGetStateFromPath,
    /**
     * Only change url at whitelist routes, or return home page
     */
    getPathFromState(state, options) {
      const defaultPath = getPathFromStateDefault(state, options);
      const defaultPathWithoutQuery = (defaultPath.split('?')[0] || '').replace(
        FULL_SCREEN_MODAL_PATH,
        MODAL_PATH,
      );

      let rule = allowList[defaultPathWithoutQuery];

      if (!rule) {
        const key = allowListKeys.find((k) => new RegExp(k).test(defaultPath));
        if (key) {
          rule = allowList[key];
        }
      }

      if (!rule?.showUrl) {
        return ROOT_PATH;
      }

      const newPath = rule?.showParams ? defaultPath : defaultPathWithoutQuery;
      // keep manifest url with html file
      if (platformEnv.isExtension) {
        /*
        check chrome.webRequest.onBeforeRequest
         /ui-expand-tab.html/#/   not working for Windows Chrome
         /ui-expand-tab.html#/    works fine
        */
        if (newPath === '/' && globalThis.location.href.endsWith('#/')) {
          // fix the scenarios of /#, #/, and /#/
          return extHtmlFileUrl;
        }
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
  const linking = useBuildLinking();
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
        linking,
      } as INavigationContainerProps,
    };
  }, [linking, routerRef]);
};
