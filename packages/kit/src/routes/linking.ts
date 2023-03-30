import { getPathFromState as getPathFromStateDefault } from '@react-navigation/core';
import * as Linking from 'expo-linking';
import { merge } from 'lodash';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  ONEKEY_APP_DEEP_LINK,
  WALLET_CONNECT_DEEP_LINK,
} from '../components/WalletConnect/walletConnectConsts';
import { EOnboardingRoutes } from '../views/Onboarding/routes/enums';

import { legacyLinkingPathMap, linkingPathMap } from './linking.path';
import { buildAppRootTabName } from './Root/Main/Tab/tabNavHeader';
import {
  DappConnectionModalRoutes,
  HomeRoutes,
  MainRoutes,
  ManageNetworkModalRoutes,
  ManageTokenModalRoutes,
  ModalRoutes,
  RootRoutes,
  SendModalRoutes,
  SubmitRequestModalRoutes,
  TabRoutes,
} from './routesEnum';

import type { LinkingOptions } from '@react-navigation/native';

const prefix = Linking.createURL('/');

type WhiteListItem = {
  screen:
    | string
    | {
        vertical: string;
        desktop: string;
      };
  path?: string;
  exact?: boolean;
};

type WhiteListItemList = WhiteListItem[];

function buildAppRootTabScreen(tabName: TabRoutes) {
  return `${RootRoutes.Main}/${MainRoutes.Tab}/${tabName}/${buildAppRootTabName(
    tabName,
  )}`;
}

export const normalRouteWhiteList: WhiteListItemList = [
  {
    screen: `${RootRoutes.Onboarding}/${EOnboardingRoutes.Welcome}`,
  },
  {
    screen: `${RootRoutes.OnLanding}`,
    path: linkingPathMap.onLanding, // /onlanding
  },
  {
    screen: `${RootRoutes.OnLandingWalletConnect}`,
    path: linkingPathMap.walletConnectUniversalLink, // /wc/connect/wc
    exact: true,
  },
  {
    screen: `${RootRoutes.Account}`,
    path: linkingPathMap.watchingAccountAdding, // /account/:address/:networkId?
    exact: true,
  },
  {
    screen: buildAppRootTabScreen(TabRoutes.Home),
    path: linkingPathMap.tabHome,
    exact: true,
  },
  {
    screen: buildAppRootTabScreen(TabRoutes.NFT),
    path: linkingPathMap.tabNFT,
    exact: true,
  },
  {
    screen: buildAppRootTabScreen(TabRoutes.Market),
    path: linkingPathMap.tabMarket,
    exact: true,
  },
  {
    screen: buildAppRootTabScreen(TabRoutes.Swap),
    path: linkingPathMap.tabSwap,
    exact: true,
  },
  {
    screen: buildAppRootTabScreen(TabRoutes.Me),
    path: linkingPathMap.tabMe,
    exact: true,
  },
  {
    screen: buildAppRootTabScreen(TabRoutes.Discover),
    path: linkingPathMap.tabDiscover,
    exact: true,
  },
  {
    screen: buildAppRootTabScreen(TabRoutes.Developer),
    path: linkingPathMap.tabDeveloper,
    exact: true,
  },
  {
    screen: `${RootRoutes.Modal}/${ModalRoutes.SubmitRequest}/${SubmitRequestModalRoutes.SubmitRequestModal}`,
  },
  {
    screen: `${RootRoutes.Modal}/${ModalRoutes.DappConnectionModal}/${DappConnectionModalRoutes.ConnectionModal}`,
  },
  {
    screen: `${RootRoutes.Modal}/${ModalRoutes.DappConnectionModal}/${DappConnectionModalRoutes.NetworkNotMatchModal}`,
  },
  {
    screen: `${RootRoutes.Modal}/${ModalRoutes.ManageNetwork}/${ManageNetworkModalRoutes.AddNetworkConfirm}`,
  },
  {
    screen: `${RootRoutes.Modal}/${ModalRoutes.ManageNetwork}/${ManageNetworkModalRoutes.SwitchNetwork}`,
  },
  {
    screen: `${RootRoutes.Modal}/${ModalRoutes.ManageNetwork}/${ManageNetworkModalRoutes.SwitchRpc}`,
  },
  {
    screen: `${RootRoutes.Modal}/${ModalRoutes.ManageToken}/${ManageTokenModalRoutes.AddToken}`,
  },
  {
    screen: `${RootRoutes.Modal}/${ModalRoutes.Send}/${SendModalRoutes.SendConfirmFromDapp}`,
  },
  {
    screen: `${RootRoutes.Main}/${MainRoutes.Tab}/${TabRoutes.Home}/${HomeRoutes.RevokeRedirect}`,
    path: legacyLinkingPathMap.revokeMobile,
    exact: true,
  },
  {
    screen: `${RootRoutes.Main}/${MainRoutes.Tab}/${TabRoutes.Home}/${HomeRoutes.RevokeRedirect2}`,
    path: legacyLinkingPathMap.revokeDesktop,
    exact: true,
  },
  {
    screen: `${RootRoutes.Main}/${MainRoutes.Tab}/${TabRoutes.Home}/${HomeRoutes.ScreenTokenDetail}`,
    path: linkingPathMap.tokenDetail,
    exact: true,
  },
  {
    screen: `${RootRoutes.Main}/${MainRoutes.Tab}/${TabRoutes.Home}/${HomeRoutes.Revoke}`,
    path: linkingPathMap.revoke,
    exact: true,
  },
  {
    screen: `${RootRoutes.Main}/${MainRoutes.Tab}/${TabRoutes.Market}/${HomeRoutes.MarketDetail}`,
    path: linkingPathMap.marketDetail,
    exact: true,
  },
  {
    screen: `${RootRoutes.Main}/${MainRoutes.Tab}/${TabRoutes.Home}/${HomeRoutes.NFTPNLScreen}`,
    path: linkingPathMap.pnlAtHome,
    exact: true,
  },
  {
    screen: `${RootRoutes.Main}/${MainRoutes.Tab}/${TabRoutes.NFT}/${HomeRoutes.NFTPNLScreen}`,
    path: linkingPathMap.pnlAtNFT,
    exact: true,
  },
  {
    screen: `${RootRoutes.Main}/${MainRoutes.Tab}/${TabRoutes.Home}/${HomeRoutes.BulkSender}`,
    path: linkingPathMap.bulkSender,
    exact: true,
  },
  /**
   * refresh page will flash the last item of normalRouteWhiteList
   * ** please add exact routes above here
   * */
  {
    screen: `${RootRoutes.Main}`,
    path: `/`,
    exact: true,
  },
];

const getScreen = (screen: WhiteListItem['screen']) => {
  if (typeof screen === 'string') {
    return screen;
  }
  return screen.desktop;

  // **** vertical route is deprecated
  // if (isVerticalLayout && screen.vertical) {
  //   return screen.vertical;
  // }
  // return screen.desktop;
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
  path?: string;
  exact?: boolean;
  fullPath?: string;
}): Record<string, any> => {
  const screens = screenListStr.split('/').filter(Boolean);
  let pathStr = path;
  if (!pathStr && screenListStr) {
    pathStr = `/${screenListStr}`;
  }
  const pathList = (pathStr || '').split('/').filter(Boolean);
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
) =>
  whiteListConfig.reduce(
    (memo, tab) =>
      merge(
        memo,
        generateScreenHierarchyRouteConfig({
          screenListStr: getScreen(tab.screen),
          path: tab.path,
          exact: tab.exact,
          fullPath: tab.path,
        }),
      ),
    {},
  );

const whiteList = [...normalRouteWhiteList];

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

const buildLinking = (): LinkingOptions<any> => {
  const screenHierarchyConfig =
    generateScreenHierarchyRouteConfigList(normalRouteWhiteList);
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
      initialRouteName: RootRoutes.Main,
      screens: {
        ...screenHierarchyConfig,
        // custom route with path params needs to be defined at last
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
