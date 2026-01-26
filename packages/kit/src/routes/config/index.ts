/* eslint-disable @typescript-eslint/no-unsafe-call */
import { useMemo } from 'react';

import { getPathFromState as getPathFromStateDefault } from '@react-navigation/core';
import { createURL } from 'expo-linking';
import { useIntl } from 'react-intl';

import {
  type INavigationContainerProps,
  rootNavigationRef,
  useRouterEventsRef,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ERootRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import { getExtensionIndexHtml } from '@onekeyhq/shared/src/utils/extUtils';
import type { IScreenPathConfig } from '@onekeyhq/shared/src/utils/routeUtils';
import { buildAllowList } from '@onekeyhq/shared/src/utils/routeUtils';

import { usePerpTabConfig } from '../../hooks/usePerpTabConfig';
import { rootRouter, useRootRouter } from '../router';

import { registerDeepLinking } from './deeplink';
import { getStateFromPath } from './getStateFromPath';

import type { LinkingOptions } from '@react-navigation/native';

const routerPrefix = createURL('/');

interface IScreenRouterConfig {
  name: string;
  rewrite?: string;
  exact?: boolean;
  children?: IScreenRouterConfig[] | null;
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
const ROOT_PATH = platformEnv.isExtension ? extHtmlFileUrl : '/';

const MODAL_PATH = `/${ERootRoutes.Modal}`;
const FULL_SCREEN_MODAL_PATH = `/${ERootRoutes.iOSFullScreen}`;

const onGetStateFromPath = (path: string, options?: any) => {
  // Web platform: rewrite ?r= referral parameter to /r/{code}/app/{page} format
  if (platformEnv.isWeb) {
    const [pathPart, queryPart] = path.split('?');
    if (queryPart) {
      const searchParams = new URLSearchParams(queryPart);
      const referralCode = searchParams.get('r');
      if (referralCode) {
        const pagePath = pathPart.replace(/^\//, '').replace(/\/$/, '');
        const rewrittenPath = pagePath
          ? `/r/${referralCode}/app/${pagePath}`
          : `/r/${referralCode}/app`;
        return getStateFromPath(rewrittenPath, options);
      }
    }
  }
  return getStateFromPath(path, options);
};

const useBuildLinking = (): LinkingOptions<any> => {
  const routes = useRootRouter();
  const { perpDisabled, perpTabShowWeb } = usePerpTabConfig();
  return useMemo(() => {
    const screenHierarchyConfig = resolveScreens(routes);
    if (!screenHierarchyConfig) {
      return { prefixes: [routerPrefix] };
    }
    const allowList = buildAllowList(
      screenHierarchyConfig || {},
      perpDisabled,
      perpTabShowWeb,
    );
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
        const defaultPathWithoutQuery = (
          defaultPath.split('?')[0] || ''
        ).replace(FULL_SCREEN_MODAL_PATH, MODAL_PATH);

        let rule = allowList[defaultPathWithoutQuery];

        if (!rule) {
          const key = allowListKeys.find((k) =>
            new RegExp(k).test(defaultPath),
          );
          if (key) {
            rule = allowList[key];
          }
        }

        if (!rule?.showUrl) {
          return ROOT_PATH;
        }

        const newPath = rule?.showParams
          ? defaultPath
          : defaultPathWithoutQuery;
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
  }, [perpDisabled, perpTabShowWeb, routes]);
};

const TAB_TITLE_TRANSLATION_MAP: Record<ETabRoutes, ETranslations | null> = {
  [ETabRoutes.Home]: null,
  [ETabRoutes.Market]: ETranslations.global_market,
  [ETabRoutes.Discovery]: ETranslations.global_discover,
  [ETabRoutes.Earn]: ETranslations.global_earn,
  [ETabRoutes.Swap]: ETranslations.global_swap,
  [ETabRoutes.Perp]: ETranslations.global_perp,
  [ETabRoutes.WebviewPerpTrade]: ETranslations.global_perp,
  [ETabRoutes.MultiTabBrowser]: ETranslations.global_browser,
  [ETabRoutes.Developer]: ETranslations.global_homescreen,
  [ETabRoutes.DeviceManagement]: ETranslations.global_homescreen,
  [ETabRoutes.ReferFriends]: ETranslations.sidebar_refer_a_friend,
};

export const useRouterConfig = () => {
  const routerRef = useRouterEventsRef();
  const linking = useBuildLinking();
  const intl = useIntl();

  return useMemo(() => {
    // Execute it before component mount.
    registerDeepLinking();
    return {
      routerConfig: rootRouter,
      containerProps: {
        documentTitle: {
          formatter: (_options, _route) => {
            if (!platformEnv.isWebDappMode) {
              return 'OneKey';
            }

            const state = rootNavigationRef.current?.getRootState();
            if (!state) {
              return 'OneKey';
            }

            const rootState = state?.routes.find(
              ({ name }) => name === ERootRoutes.Main,
            )?.state;

            if (!rootState) {
              return 'OneKey';
            }

            const currentTabName = rootState?.routeNames
              ? (rootState?.routeNames?.[rootState?.index || 0] as ETabRoutes)
              : (rootState?.routes[0].name as ETabRoutes);

            const translationKey = TAB_TITLE_TRANSLATION_MAP[currentTabName];
            const tabTitle = translationKey
              ? intl.formatMessage({ id: translationKey })
              : '';

            return tabTitle ? `OneKey - ${tabTitle}` : 'OneKey';
          },
        },
        onStateChange: (state) => {
          routerRef.current.forEach((cb) => cb?.(state));
        },
        linking,
      } as INavigationContainerProps,
    };
  }, [linking, routerRef, intl]);
};
