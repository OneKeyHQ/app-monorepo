import { getPathFromState as getPathFromStateDefault } from '@react-navigation/core';
import { LinkingOptions } from '@react-navigation/native';
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

import { AccountRootLandingPathSchema } from './Root/AccountRootLanding';
import { HomeRoutes, ModalRoutes, RootRoutes, TabRoutes } from './routesEnum';

const prefix = Linking.createURL('/');

type WhiteListItem = {
  path: string;
  screen: string;
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
    screen: `${RootRoutes.Onboarding}/${EOnboardingRoutes.Welcome}`,
    path: `/${RootRoutes.Onboarding}/${EOnboardingRoutes.Welcome}`,
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
  // vertical layout
  {
    screen: `${RootRoutes.Root}/${HomeRoutes.InitialTab}/${RootRoutes.Tab}/${TabRoutes.Home}/${HomeRoutes.ScreenTokenDetail}`,
    path: `/${RootRoutes.Root}/${HomeRoutes.InitialTab}/${RootRoutes.Tab}/${TabRoutes.Home}/${HomeRoutes.ScreenTokenDetail}`,
  },
  // desktop layout
  {
    screen: `${RootRoutes.Root}/${HomeRoutes.ScreenTokenDetail}`,
    path: `/${RootRoutes.Root}/${HomeRoutes.ScreenTokenDetail}`,
  },
];

/**
 * split white list config and generate hierarchy config for react-navigation linking config
 */
const generateScreenHierarchyRouteConfig = (
  screenListStr: string,
  path: string,
): Record<string, any> => {
  const screens = screenListStr.split('/').filter(Boolean);
  const pathList = path.split('/').filter(Boolean);
  if (!screens.length || !pathList.length) {
    return {};
  }

  const currentRoute = screens[0];
  const currentPath = pathList[0];
  return {
    [currentRoute]: {
      path: `/${currentPath}`,
      screens: generateScreenHierarchyRouteConfig(
        screens.slice(1).join('/'),
        pathList.slice(1).join('/'),
      ),
    },
  };
};

const generateScreenHierarchyRouteConfigList = (
  whiteListConfig: WhiteListItemList,
) =>
  whiteListConfig.reduce(
    (memo, tab) =>
      merge(memo, generateScreenHierarchyRouteConfig(tab.screen, tab.path)),
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
      [tabRoute.screen]: {
        path: isVerticalLayout ? tabRoute.path : undefined,
        ...(isVerticalLayout
          ? {}
          : {
              screens: {
                [`tab-${tabRoute.screen}`]: tabRoute.path,
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

const buildLinking = (isVerticalLayout?: boolean): LinkingOptions<any> => ({
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
      ...generateScreenHierarchyRouteConfigList(normalRouteWhiteList),
      // custom route with path params needs to be defined at last
      [RootRoutes.Account]: AccountRootLandingPathSchema,
      NotFound: '*',
    },
  },
});

export default buildLinking;
