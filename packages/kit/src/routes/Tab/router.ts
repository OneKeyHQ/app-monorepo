import { useMemo } from 'react';

import { CommonActions } from '@react-navigation/native';

import {
  getTokenValue,
  rootNavigationRef,
  useMedia,
} from '@onekeyhq/components';
import type {
  ITabNavigatorConfig,
  ITabNavigatorExtraConfig,
} from '@onekeyhq/components/src/layouts/Navigation/Navigator/types';
import {
  useIsGtMdNonNative,
  useToMyOneKeyModalByRootNavigation,
} from '@onekeyhq/kit/src/views/DeviceManagement/hooks/useToMyOneKeyModal';
import {
  usePerpsCommonConfigPersistAtom,
  usePerpsUserConfigPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabMarketRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EPerpUserType } from '@onekeyhq/shared/types/hyperliquid';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { usePerpTabConfig } from '../../hooks/usePerpTabConfig';
import { useToReferFriendsModalByRootNavigation } from '../../hooks/useReferFriends';
import { developerRouters } from '../../views/Developer/router';
import { homeRouters } from '../../views/Home/router';
import { perpRouters } from '../../views/Perp/router';
import { perpTradeRouters as perpWebviewRouters } from '../../views/PerpTrade/router';

import { discoveryRouters } from './Discovery/router';
import { earnRouters } from './Earn/router';
import { marketRouters } from './Marktet/router';
import { meRouters } from './Me/router';
import { multiTabBrowserRouters } from './MultiTabBrowser/router';
import { swapRouters } from './Swap/router';

type IGetTabRouterParams = {
  freezeOnBlur?: boolean;
};

const useIsShowDesktopDiscover = () => {
  const { gtMd } = useMedia();
  return useMemo(
    () => platformEnv.isDesktop || (platformEnv.isNative && gtMd),
    [gtMd],
  );
};

const getDiscoverRouterConfig = (
  params?: IGetTabRouterParams,
  tabBarStyle?: ITabNavigatorConfig<ETabRoutes>['tabBarStyle'],
) => {
  const discoverRouterConfig: ITabNavigatorConfig<ETabRoutes> = {
    name: ETabRoutes.Discovery,
    rewrite: '/discovery',
    exact: true,
    tabBarIcon: (focused?: boolean) =>
      focused ? 'CompassCircleSolid' : 'CompassCircleOutline',
    translationId: ETranslations.global_browser,
    freezeOnBlur: Boolean(params?.freezeOnBlur),
    children: discoveryRouters,
    tabBarStyle,
    trackId: 'global-browser',
  };
  return discoverRouterConfig;
};

export const useTabRouterConfig = (params?: IGetTabRouterParams) => {
  const { md } = useMedia();

  const isShowDesktopDiscover = useIsShowDesktopDiscover();
  const isWebDappMode = platformEnv.isWebDappMode;
  const isShowMDDiscover = useMemo(
    () =>
      !isShowDesktopDiscover &&
      !platformEnv.isWebDappMode &&
      !platformEnv.isExtensionUiPopup &&
      !(platformEnv.isExtensionUiSidePanel && md),
    [isShowDesktopDiscover, md],
  );

  const toMyOneKeyModal = useToMyOneKeyModalByRootNavigation();
  const toReferFriendsPage = useToReferFriendsModalByRootNavigation();
  const isGtMdNonNative = useIsGtMdNonNative();
  const shouldShowMarketTab = !(
    platformEnv.isExtensionUiPopup || platformEnv.isExtensionUiSidePanel
  );

  const { perpDisabled, perpTabShowWeb } = usePerpTabConfig();
  const perpTabShowRes = useMemo(() => {
    if (perpDisabled) {
      return null;
    }
    if (perpTabShowWeb) {
      return {
        name: ETabRoutes.WebviewPerpTrade,
        tabBarIcon: (focused?: boolean) =>
          focused ? 'TradingViewCandlesSolid' : 'TradingViewCandlesOutline',
        translationId: ETranslations.global_perp,
        freezeOnBlur: Boolean(params?.freezeOnBlur),
        rewrite: '/perp',
        exact: true,
        children: platformEnv.isExtension
          ? // small screen error: Cannot read properties of null (reading 'filter')
            // null
            perpWebviewRouters
          : perpWebviewRouters,
        trackId: 'global-perp',
      };
    }
    return {
      name: ETabRoutes.Perp,
      tabBarIcon: (focused?: boolean) =>
        focused ? 'TradingViewCandlesSolid' : 'TradingViewCandlesOutline',
      translationId: ETranslations.global_perp,
      freezeOnBlur: Boolean(params?.freezeOnBlur),
      children: perpRouters,
      rewrite: '/perp',
      exact: true,
      // tabbarOnPress,
    };
  }, [perpDisabled, perpTabShowWeb, params?.freezeOnBlur]);
  // Custom Market tab press handler - only for non-mobile platforms
  const handleMarketTabPress = useMemo(() => {
    return () => {
      const navigation = rootNavigationRef.current;
      if (navigation) {
        // Always navigate to Market home when this handler is called
        // Since this is only called when Market tab is already selected,
        // we can assume user wants to go to Market home
        navigation.dispatch(
          CommonActions.navigate({
            name: ETabRoutes.Market,
            params: {
              screen: ETabMarketRoutes.TabMarket,
            },
          }),
        );
      }
    };
  }, []);

  const referFriendsTabConfig = useMemo(() => {
    return {
      name: ETabRoutes.ReferFriends,
      tabBarIcon: () => 'GiftOutline',
      translationId: ETranslations.sidebar_refer_a_friend,
      tabbarOnPress: toReferFriendsPage,
      children: null,
      trackId: 'global-referral',
    };
  }, [toReferFriendsPage]);

  return useMemo(() => {
    const tabs = [
      {
        name: ETabRoutes.Home,
        tabBarIcon: (focused?: boolean) =>
          focused ? 'WalletSolid' : 'WalletOutline',
        translationId: ETranslations.global_wallet,
        freezeOnBlur: Boolean(params?.freezeOnBlur),
        rewrite: '/',
        exact: true,
        children: homeRouters,
        trackId: 'global-wallet',
        hiddenIcon: isWebDappMode,
      },
      shouldShowMarketTab
        ? {
            name: ETabRoutes.Market,
            tabBarIcon: (focused?: boolean) =>
              focused ? 'ChartTrendingUp2Solid' : 'ChartTrendingUp2Outline',
            translationId: ETranslations.global_market,
            freezeOnBlur: Boolean(params?.freezeOnBlur),
            rewrite: '/market',
            exact: true,
            children: marketRouters,
            trackId: 'global-market',
            // Only apply custom tab press handler for non-mobile platforms
            ...(platformEnv.isDesktop ||
            platformEnv.isWeb ||
            platformEnv.isExtension
              ? { onPressWhenSelected: handleMarketTabPress }
              : {}),
          }
        : undefined,
      {
        name: ETabRoutes.Swap,
        tabBarIcon: (focused?: boolean) =>
          focused ? 'SwapHorSolid' : 'SwapHorOutline',
        translationId: ETranslations.global_trade,
        freezeOnBlur: Boolean(params?.freezeOnBlur),
        rewrite: '/swap',
        exact: true,
        children: swapRouters,
        trackId: 'global-trade',
      },
      perpTabShowRes,
      {
        name: ETabRoutes.Earn,
        tabBarIcon: (focused?: boolean) =>
          focused ? 'CoinsSolid' : 'CoinsOutline',
        translationId: ETranslations.global_earn,
        freezeOnBlur: Boolean(params?.freezeOnBlur),
        inMoreAction: true,
        rewrite: '/defi',
        exact: true,
        children: earnRouters,
        trackId: 'global-earn',
      },
      isWebDappMode ? referFriendsTabConfig : undefined,
      // In non-DAPP mode, show ReferFriends in more actions
      !isWebDappMode && isGtMdNonNative
        ? {
            ...referFriendsTabConfig,
            inMoreAction: true,
          }
        : undefined,
      isGtMdNonNative
        ? {
            name: ETabRoutes.DeviceManagement,
            tabBarIcon: () => 'OnekeyDeviceCustom',
            translationId: ETranslations.global_device,
            tabbarOnPress: toMyOneKeyModal,
            children: null,
            trackId: 'global-my-onekey',
          }
        : undefined,
      isShowMDDiscover ? getDiscoverRouterConfig(params) : undefined,
      platformEnv.isDev
        ? {
            name: ETabRoutes.Me,
            rewrite: '/me',
            exact: true,
            tabBarIcon: (focused?: boolean) =>
              focused ? 'LayoutGrid2Solid' : 'LayoutGrid2Outline',
            translationId: ETranslations.global_more,
            freezeOnBlur: Boolean(params?.freezeOnBlur),
            children: meRouters,
            trackId: 'global-me',
          }
        : undefined,
      platformEnv.isDev
        ? {
            name: ETabRoutes.Developer,
            tabBarIcon: (focused?: boolean) =>
              focused ? 'CodeBracketsSolid' : 'CodeBracketsOutline',
            translationId: ETranslations.global_dev_mode,
            freezeOnBlur: Boolean(params?.freezeOnBlur),
            rewrite: '/dev',
            exact: true,
            children: developerRouters,
            trackId: 'global-dev',
          }
        : undefined,
      isShowDesktopDiscover
        ? getDiscoverRouterConfig(params, {
            marginTop: getTokenValue('$4', 'size'),
          })
        : undefined,
    ].filter((i) => !!i) as ITabNavigatorConfig<ETabRoutes>[];

    // In WebDappMode, move Market tab to first position for initial route
    if (isWebDappMode && tabs.length >= 2) {
      const marketTabIndex = tabs.findIndex(
        (tab) => tab.name === ETabRoutes.Market,
      );
      if (marketTabIndex > 0) {
        const marketTab = tabs[marketTabIndex];
        tabs.splice(marketTabIndex, 1);
        tabs.unshift(marketTab);
      }
    }

    return tabs;
  }, [
    isWebDappMode,
    isGtMdNonNative,
    referFriendsTabConfig,
    params,
    shouldShowMarketTab,
    handleMarketTabPress,
    perpTabShowRes,
    toMyOneKeyModal,
    isShowMDDiscover,
    isShowDesktopDiscover,
  ]);
};

export const tabExtraConfig: ITabNavigatorExtraConfig<ETabRoutes> | undefined =
  {
    name: ETabRoutes.MultiTabBrowser,
    children: multiTabBrowserRouters,
  };
