import { getPathFromState as getPathFromStateDefault } from '@react-navigation/core';
import * as Linking from 'expo-linking';
import { merge } from 'lodash';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  ONEKEY_APP_DEEP_LINK,
  WALLET_CONNECT_DEEP_LINK,
} from '../components/WalletConnect/walletConnectConsts';
import { getExtensionIndexHtml } from '../utils/extUtils.getHtml';
import { EOnboardingRoutes } from '../views/Onboarding/routes/enums';
import { ScanQrcodeRoutes } from '../views/ScanQrcode/types';

import { legacyLinkingPathMap, linkingPathMap } from './linking.path';
import {
  DappConnectionModalRoutes,
  HomeRoutes,
  InscribeModalRoutes,
  MainRoutes,
  ManageNetworkModalRoutes,
  ManageTokenModalRoutes,
  ModalRoutes,
  NostrModalRoutes,
  RootRoutes,
  SendModalRoutes,
  SubmitRequestModalRoutes,
  TabRoutes,
  WeblnModalRoutes,
} from './routesEnum';
import { buildAppRootTabName } from './routesUtils';

import type { LinkingOptions } from '@react-navigation/native';

const prefix = Linking.createURL('/');

type WhiteListItem = {
  screen: string;
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
    screen: `${RootRoutes.Onboarding}`,
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
   * Inscribe transfer
   */
  {
    screen: `${RootRoutes.Modal}/${ModalRoutes.Inscribe}/${InscribeModalRoutes.InscribeTransferFromDapp}`,
  },
  /**
   * WebLN
   */
  {
    screen: `${RootRoutes.Modal}/${ModalRoutes.Webln}/${WeblnModalRoutes.MakeInvoice}`,
  },
  {
    screen: `${RootRoutes.Modal}/${ModalRoutes.Send}/${SendModalRoutes.WeblnSendPayment}`,
  },
  {
    screen: `${RootRoutes.Modal}/${ModalRoutes.Webln}/${WeblnModalRoutes.VerifyMessage}`,
  },
  {
    screen: `${RootRoutes.Modal}/${ModalRoutes.Send}/${SendModalRoutes.LNURLAuth}`,
  },
  {
    screen: `${RootRoutes.Modal}/${ModalRoutes.Send}/${SendModalRoutes.LNURLPayRequest}`,
  },
  {
    screen: `${RootRoutes.Modal}/${ModalRoutes.Send}/${SendModalRoutes.LNURLWithdraw}`,
  },
  {
    screen: `${RootRoutes.Modal}/${ModalRoutes.ScanQrcode}/${ScanQrcodeRoutes.RequestPermission}`,
  },
  /**
   * Nostr
   */
  {
    screen: `${RootRoutes.Modal}/${ModalRoutes.Nostr}/${NostrModalRoutes.GetPublicKey}`,
  },
  {
    screen: `${RootRoutes.Modal}/${ModalRoutes.Nostr}/${NostrModalRoutes.SignEvent}`,
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
  return screen;

  // **** vertical route is deprecated
  // if (isVerticalLayout && screen.vertical) {
  //   return screen.vertical;
  // }
  // return screen.desktop;
};

function createPathFromScreen(screen: string) {
  return `/${screen}`;
}

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
    pathStr = createPathFromScreen(screenListStr);
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

function buildWhiteList() {
  const list = [...normalRouteWhiteList];
  list.forEach((item) => {
    item.path = item.path || createPathFromScreen(item.screen);
  });
  return list;
}

const whiteList = buildWhiteList();

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

      const isWhiteList = whiteList.some(
        (item) =>
          defaultPathWithoutQuery && item.path === defaultPathWithoutQuery,
      );
      if (isWhiteList) {
        newPath = defaultPath;
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
