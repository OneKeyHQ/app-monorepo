import { getPathFromState as getPathFromStateDefault } from '@react-navigation/core';
import * as Linking from 'expo-linking';
import { merge } from 'lodash';

import { DappConnectionModalRoutes } from '@onekeyhq/kit/src/views/DappModals/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  ONEKEY_APP_DEEP_LINK,
  WALLET_CONNECT_DEEP_LINK,
} from '../components/WalletConnect/walletConnectConsts';
import { ManageNetworkRoutes } from '../views/ManageNetworks/types';
import { ManageTokenRoutes } from '../views/ManageTokens/types';
import { EOnboardingRoutes } from '../views/Onboarding/routes/enums';
import { SendRoutes } from '../views/Send/types';

import { WalletConnectUniversalLinkPathSchema } from './deepLink';
import { SubmitRequestRoutes } from './Modal/SubmitRequest';
import { AccountRootLandingPathSchema } from './Root/AccountRootLanding';
import { HomeRoutes, ModalRoutes, RootRoutes, TabRoutes } from './routesEnum';

import type { LinkingOptions } from '@react-navigation/native';

const prefix = Linking.createURL('/');

type WhiteListItem = {
  screen:
    | string
    | {
        vertical: string;
        desktop: string;
      };
  path: string;
  exact?: boolean;
};

type WhiteListItemList = WhiteListItem[];

const tabRoutesWhiteList: WhiteListItemList = [
  {
    screen: `${TabRoutes.Home}`,
    path: `/${RootRoutes.Tab}/${TabRoutes.Home}`,
  },
  {
    screen: `${TabRoutes.Discover}`,
    path: `/${RootRoutes.Tab}/${TabRoutes.Discover}`,
  },
  {
    screen: `${TabRoutes.Me}`,
    path: `/${RootRoutes.Tab}/${TabRoutes.Me}`,
  },
  {
    screen: `${TabRoutes.Swap}`,
    path: `/${RootRoutes.Tab}/${TabRoutes.Swap}`,
  },
  {
    screen: `${TabRoutes.Market}`,
    path: `/${RootRoutes.Tab}/${TabRoutes.Market}`,
  },
  {
    screen: `${TabRoutes.NFT}`,
    path: `/${RootRoutes.Tab}/${TabRoutes.NFT}`,
  },
];

const normalRouteWhiteList: WhiteListItemList = [
  {
    screen: `${RootRoutes.Account}`,
    path: `/${RootRoutes.Account}`,
  },
  {
    screen: `${RootRoutes.OnLanding}`,
    path: `/${RootRoutes.OnLanding}`,
  },
  {
    screen: `${RootRoutes.OnLandingWalletConnect}`,
    path: `/${RootRoutes.OnLandingWalletConnect}`,
  },
  {
    screen: `${RootRoutes.Onboarding}/${EOnboardingRoutes.Welcome}`,
    path: `/${RootRoutes.Onboarding}/${EOnboardingRoutes.Welcome}`,
  },
  {
    screen: `${RootRoutes.Modal}/${ModalRoutes.SubmitRequest}/${SubmitRequestRoutes.SubmitRequestModal}`,
    path: `/${RootRoutes.Modal}/${ModalRoutes.SubmitRequest}/${SubmitRequestRoutes.SubmitRequestModal}`,
  },
  {
    screen: `${RootRoutes.Modal}/${ModalRoutes.DappConnectionModal}/${DappConnectionModalRoutes.ConnectionModal}`,
    path: `/${RootRoutes.Modal}/${ModalRoutes.DappConnectionModal}/${DappConnectionModalRoutes.ConnectionModal}`,
  },
  {
    screen: `${RootRoutes.Modal}/${ModalRoutes.DappConnectionModal}/${DappConnectionModalRoutes.NetworkNotMatchModal}`,
    path: `/${RootRoutes.Modal}/${ModalRoutes.DappConnectionModal}/${DappConnectionModalRoutes.NetworkNotMatchModal}`,
  },
  {
    screen: `${RootRoutes.Modal}/${ModalRoutes.ManageNetwork}/${ManageNetworkRoutes.AddNetworkConfirm}`,
    path: `/${RootRoutes.Modal}/${ModalRoutes.ManageNetwork}/${ManageNetworkRoutes.AddNetworkConfirm}`,
  },
  {
    screen: `${RootRoutes.Modal}/${ModalRoutes.ManageNetwork}/${ManageNetworkRoutes.SwitchNetwork}`,
    path: `/${RootRoutes.Modal}/${ModalRoutes.ManageNetwork}/${ManageNetworkRoutes.SwitchNetwork}`,
  },
  {
    screen: `${RootRoutes.Modal}/${ModalRoutes.ManageToken}/${ManageTokenRoutes.AddToken}`,
    path: `/${RootRoutes.Modal}/${ModalRoutes.ManageToken}/${ManageTokenRoutes.AddToken}`,
  },
  {
    screen: `${RootRoutes.Modal}/${ModalRoutes.Send}/${SendRoutes.SendConfirmFromDapp}`,
    path: `/${RootRoutes.Modal}/${ModalRoutes.Send}/${SendRoutes.SendConfirmFromDapp}`,
  },
  {
    screen: `${RootRoutes.Root}/${HomeRoutes.InitialTab}/${RootRoutes.Tab}/${TabRoutes.Home}/${HomeRoutes.RevokeRedirect}`,
    path: `${RootRoutes.Root}/${HomeRoutes.InitialTab}/${RootRoutes.Tab}/${TabRoutes.Home}/${HomeRoutes.Revoke}`,
    exact: true,
  },
  {
    screen: `${RootRoutes.Root}/${HomeRoutes.RevokeRedirect}`,
    path: `${RootRoutes.Root}/${HomeRoutes.Revoke}`,
    exact: true,
  },
  {
    screen: {
      vertical: `${RootRoutes.Root}/${HomeRoutes.ScreenTokenDetail}`,
      desktop: `${RootRoutes.Root}/${HomeRoutes.InitialTab}/${RootRoutes.Tab}/${TabRoutes.Home}/${HomeRoutes.ScreenTokenDetail}`,
    },
    path: `/tokenDetail`,
    exact: true,
  },
  {
    screen: {
      vertical: `${RootRoutes.Root}/${HomeRoutes.Revoke}`,
      desktop: `${RootRoutes.Root}/${HomeRoutes.InitialTab}/${RootRoutes.Tab}/${TabRoutes.Home}/${HomeRoutes.Revoke}`,
    },
    path: `/revoke`,
    exact: true,
  },
  {
    screen: {
      vertical: `${RootRoutes.Root}/${HomeRoutes.MarketDetail}`,
      desktop: `${RootRoutes.Root}/${HomeRoutes.InitialTab}/${RootRoutes.Tab}/${TabRoutes.Market}/${HomeRoutes.MarketDetail}`,
    },
    path: `/marketDetail`,
    exact: true,
  },
  {
    screen: {
      vertical: `${RootRoutes.Root}/${HomeRoutes.NFTPNLScreen}`,
      desktop: `${RootRoutes.Root}/${HomeRoutes.InitialTab}/${RootRoutes.Tab}/${TabRoutes.NFT}/${HomeRoutes.NFTPNLScreen}`,
    },
    path: `/pnl`,
    exact: true,
  },
  {
    screen: {
      vertical: `${RootRoutes.Root}/${HomeRoutes.BulkSender}`,
      desktop: `${RootRoutes.Root}/${HomeRoutes.InitialTab}/${RootRoutes.Tab}/${TabRoutes.Home}/${HomeRoutes.BulkSender}`,
    },
    path: `/bulkSender`,
    exact: true,
  },
  /**
   * refresh page will flash the last item of normalRouteWhiteList
   * ** please add exact routes above here
   * */
  {
    screen: `${RootRoutes.Root}`,
    path: `/`,
    exact: true,
  },
];

const getScreen = (
  screen: WhiteListItem['screen'],
  isVerticalLayout?: boolean,
) => {
  if (typeof screen === 'string') {
    return screen;
  }
  if (isVerticalLayout && screen.vertical) {
    return screen.vertical;
  }
  return screen.desktop;
};

/**
 * split white list config and generate hierarchy config for react-navigation linking config
 */
const generateScreenHierarchyRouteConfig = ({
  screenListStr,
  path,
  exact,
  fullPath,
}: {
  screenListStr: string;
  path: string;
  exact?: boolean;
  fullPath: string;
}): Record<string, any> => {
  const screens = screenListStr.split('/').filter(Boolean);
  const pathList = (path || '').split('/').filter(Boolean);
  if (!screens.length || (!pathList.length && !exact)) {
    return {};
  }

  const currentRoute = screens[0];
  const currentPath = pathList[0] || currentRoute;

  const isLastScreen = screens.length === 1;
  const isExactUrl = Boolean(isLastScreen && exact);
  return {
    [currentRoute]: {
      path: isExactUrl ? fullPath : `/${currentPath}`,
      exact: isExactUrl,
      screens: generateScreenHierarchyRouteConfig({
        screenListStr: screens.slice(1).join('/'),
        path: pathList.slice(1).join('/'),
        fullPath,
        exact,
      }),
    },
  };
};

const generateScreenHierarchyRouteConfigList = (
  whiteListConfig: WhiteListItemList,
  isVerticalLayout = false,
) =>
  whiteListConfig.reduce(
    (memo, tab) =>
      merge(
        memo,
        generateScreenHierarchyRouteConfig({
          screenListStr: getScreen(tab.screen, isVerticalLayout),
          path: tab.path,
          exact: tab.exact,
          fullPath: tab.path,
        }),
      ),
    {},
  );

const whiteList = [...tabRoutesWhiteList, ...normalRouteWhiteList];

/**
 *  For tab routes:
 *  vertical layout: home
 *  horizontal layout: home -> tab-home
 *  make them as same route url at linking
 *  home: {
      path: isVerticalLayout ? '/tab/home' : undefined,
      ...(isVerticalLayout
        ? {}
        : {
            screens: {
              'tab-home': '/tab/home',
            },
          }),
    }
 */
function generateTabHierarchy(isVerticalLayout?: boolean) {
  return tabRoutesWhiteList.reduce(
    (memo, tabRoute) => ({
      ...memo,
      [getScreen(tabRoute.screen)]: {
        path: isVerticalLayout ? tabRoute.path : undefined,
        ...(isVerticalLayout
          ? {}
          : {
              screens: {
                [`tab-${getScreen(tabRoute.screen)}`]: tabRoute.path,
              },
            }),
      },
    }),
    {},
  );
}

export function getExtensionIndexHtml() {
  if (platformEnv.isExtensionBackgroundHtml) {
    return 'background.html';
  }
  if (platformEnv.isExtensionUiPopup) {
    return 'ui-popup.html';
  }
  if (platformEnv.isExtensionUiExpandTab) {
    return 'ui-expand-tab.html';
  }
  if (platformEnv.isExtensionUiStandaloneWindow) {
    return 'ui-standalone-window.html';
  }
  return 'ui-expand-tab.html';
}

const buildLinking = (isVerticalLayout?: boolean): LinkingOptions<any> => {
  const screenHierarchyConfig = generateScreenHierarchyRouteConfigList(
    normalRouteWhiteList,
    isVerticalLayout,
  );
  return {
    enabled: true,
    prefixes: [prefix, ONEKEY_APP_DEEP_LINK, WALLET_CONNECT_DEEP_LINK],
    /**
     * Only change url at whitelist routes, or return home page
     */
    getPathFromState(state, options) {
      /**
       * firefox route issue, refresh cannot recognize hash, just redirect to home page after refresh.
       */
      if (platformEnv.isExtFirefox) {
        return `/${getExtensionIndexHtml()}`;
      }
      const defaultPath = getPathFromStateDefault(state, options);
      const defaultPathWithoutQuery = defaultPath.split('?')[0] || '';

      const isWhiteList = whiteList.some(
        (item) =>
          defaultPathWithoutQuery && item.path === defaultPathWithoutQuery,
      );
      if (isWhiteList) return defaultPath;
      return '/';
    },
    config: {
      initialRouteName: RootRoutes.Root,
      screens: {
        [RootRoutes.Root]: {
          screens: {
            [HomeRoutes.InitialTab]: {
              screens: {
                [RootRoutes.Tab]: {
                  screens: generateTabHierarchy(isVerticalLayout),
                },
              },
            },
          },
        },
        ...screenHierarchyConfig,
        // custom route with path params needs to be defined at last
        // /account/:address/:networkId?
        [RootRoutes.Account]: AccountRootLandingPathSchema,
        // /wc/connect/wc
        [RootRoutes.OnLandingWalletConnect]:
          WalletConnectUniversalLinkPathSchema,
        NotFound: '*',
      },
    },
  };
};

/*
packages/kit/src/components/AppLock/AppLock.tsx
  unlockWhiteListUrl
 */

export default buildLinking;
