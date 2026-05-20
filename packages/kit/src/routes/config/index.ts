/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
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
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { debugLandingLog } from '@onekeyhq/shared/src/performance/init';
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

const tabRouteNames: ReadonlySet<string> = new Set(Object.values(ETabRoutes));

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
          if (config.length > 0 && tabRouteNames.has(route.name)) {
            prev[route.name].initialRouteName = config[0].name;
          }
        }

        return prev;
      }, {} as IScreenPathConfig)
    : undefined;
const extHtmlFileUrl = `/${getExtensionIndexHtml()}`;
const ROOT_PATH = platformEnv.isExtension ? extHtmlFileUrl : '/';

const MODAL_PATH = `/${ERootRoutes.Modal}`;
const FULL_SCREEN_MODAL_PATH = `/${ERootRoutes.iOSFullScreen}`;
const FULL_SCREEN_PUSH_PATH = `/${ERootRoutes.FullScreenPush}`;

const onGetStateFromPath = (path: string, options?: any) => {
  if (process.env.NODE_ENV !== 'production') {
    debugLandingLog('getStateFromPath', `path="${path}"`);
  }
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
  // WebDappMode: rewrite "/" to "/market" so Market tab is the landing page
  if (platformEnv.isWebDappMode && (path === '/' || path === '')) {
    const result = getStateFromPath('/market', options);
    if (process.env.NODE_ENV !== 'production') {
      const mainState = result?.routes?.[0]?.state;
      debugLandingLog(
        'getStateFromPath result',
        `rewrite "/" -> "/market", tabRoutes=${JSON.stringify(mainState?.routes?.map((r: any) => r.name))}, stateIndex=${mainState?.index}`,
      );
    }
    return result;
  }
  const result = getStateFromPath(path, options);
  if (process.env.NODE_ENV !== 'production') {
    const mainState = result?.routes?.[0]?.state;
    debugLandingLog(
      'getStateFromPath result',
      `path="${path}", tabRoutes=${JSON.stringify(mainState?.routes?.map((r: any) => r.name))}, stateIndex=${mainState?.index}`,
    );
  }
  return result;
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
        const defaultPathWithoutQuery = (defaultPath.split('?')[0] || '')
          .replace(FULL_SCREEN_MODAL_PATH, MODAL_PATH)
          .replace(FULL_SCREEN_PUSH_PATH, MODAL_PATH);

        let rule = allowList[defaultPathWithoutQuery];

        if (!rule) {
          const key = allowListKeys.find((k) =>
            new RegExp(k).test(defaultPath),
          );
          if (key) {
            rule = allowList[key];
          }
        }

        if (process.env.NODE_ENV !== 'production') {
          const mainRoute = state?.routes?.[state?.index ?? 0];
          const tabState = mainRoute?.state;
          const tabIndex = tabState?.index ?? 0;
          // eslint-disable-next-line @typescript-eslint/no-shadow
          const tabRouteNames =
            tabState?.routeNames ?? tabState?.routes?.map((r: any) => r.name);
          const activeTab = tabRouteNames?.[tabIndex];
          const tabHistory = (tabState as any)?.history?.map(
            (h: any) => h.key?.split('-')?.[0] || h.type,
          );
          debugLandingLog(
            'getPathFromState',
            `defaultPath="${defaultPath}", matched=${!!rule?.showUrl}, activeTab=${activeTab}, tabIndex=${tabIndex}, tabRoutes=${JSON.stringify(tabRouteNames)}, tabHistory=${JSON.stringify(tabHistory)}`,
          );
        }

        if (!rule?.showUrl) {
          // WebDappMode: fallback to /market instead of / to avoid URL bounce
          if (platformEnv.isWebDappMode) {
            return '/market';
          }
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
  [ETabRoutes.BulkSend]: null,
  [ETabRoutes.SubPage]: null,
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
          if (process.env.NODE_ENV !== 'production') {
            const mainRoute = state?.routes?.[state?.index ?? 0];
            const tabState = mainRoute?.state;
            if (tabState) {
              const tabIndex = tabState?.index ?? 0;
              const activeTabName = (tabState?.routeNames ??
                tabState?.routes?.map((r: any) => r.name))?.[tabIndex];
              if (activeTabName === ETabRoutes.Home) {
                debugLandingLog(
                  'onStateChange',
                  `activeTab=${activeTabName}, tabIndex=${tabIndex}`,
                );
              }
            }
          }
          // Log navigation state changes for tab switch + push debugging
          if (platformEnv.isNative) {
            const mainRoute = state?.routes?.[state?.index ?? 0];
            const tabState = mainRoute?.state;
            if (tabState) {
              const tabIndex = tabState?.index ?? 0;
              const activeTab = tabState?.routes?.[tabIndex];
              const stackState = activeTab?.state;
              const topRoute =
                stackState?.routes?.[(stackState?.routes?.length ?? 1) - 1];
              if (
                activeTab?.name === ETabRoutes.Home &&
                stackState &&
                (stackState?.routes?.length ?? 0) > 1
              ) {
                defaultLogger.app.router.navStateChange({
                  tab: activeTab?.name,
                  stackDepth: stackState?.routes?.length ?? 0,
                  topRoute: topRoute?.name,
                });
              }
            }
          }
          routerRef.current.forEach((cb) => cb?.(state));
        },
        linking,
      } as INavigationContainerProps,
    };
  }, [linking, routerRef, intl]);
};
