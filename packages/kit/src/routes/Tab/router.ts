/* eslint-disable @typescript-eslint/no-unsafe-return */
import { useCallback, useMemo } from 'react';

import { CommonActions } from '@react-navigation/native';

import { rootNavigationRef, useMedia } from '@onekeyhq/components';
import type {
  INativeTabBarIcon,
  ITabNavigatorConfig,
  ITabNavigatorExtraConfig,
} from '@onekeyhq/components/src/layouts/Navigation/Navigator/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabMarketRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';

import { usePerpTabConfig } from '../../hooks/usePerpTabConfig';
import { developerRouters } from '../../views/Developer/router';
import { useDeviceManagerModalStyle } from '../../views/DeviceManagement/hooks/useDeviceManagerModalStyle';
import { homeRouters } from '../../views/Home/router';
import { perpRouters } from '../../views/Perp/router';
import { perpTradeRouters as perpWebviewRouters } from '../../views/PerpTrade/router';

import { deviceManagementRouters } from './DeviceManagement/router';
import { discoveryRouters } from './Discovery/router';
import { earnRouters } from './Earn/router';
import { marketRouters } from './Marktet/router';
import { multiTabBrowserRouters } from './MultiTabBrowser/router';
import { referFriendsRouters } from './ReferFriends/router';
import { swapRouters } from './Swap/router';

// Native tab icons using SVG files from @onekeyhq/components/svg
// The native tab bar will tint icons using tabBarActiveTintColor/tabBarInactiveTintColor
const nativeTabIcons = {
  wallet: ({ focused }: { focused: boolean }): INativeTabBarIcon =>
    focused
      ? require('@onekeyhq/components/svg/solid/wallet-4.svg')
      : require('@onekeyhq/components/svg/outline/wallet-4.svg'),
  swap: ({ focused }: { focused: boolean }): INativeTabBarIcon =>
    focused
      ? require('@onekeyhq/components/svg/solid/switch-hor.svg')
      : require('@onekeyhq/components/svg/outline/switch-hor.svg'),
  discover: ({ focused }: { focused: boolean }): INativeTabBarIcon =>
    focused
      ? require('@onekeyhq/components/svg/solid/compass.svg')
      : require('@onekeyhq/components/svg/outline/compass.svg'),
  market: ({ focused }: { focused: boolean }): INativeTabBarIcon =>
    focused
      ? require('@onekeyhq/components/svg/solid/trading-view-candles.svg')
      : require('@onekeyhq/components/svg/outline/trading-view-candles.svg'),
  perp: ({ focused }: { focused: boolean }): INativeTabBarIcon =>
    focused
      ? require('@onekeyhq/components/svg/solid/trade.svg')
      : require('@onekeyhq/components/svg/outline/trade.svg'),
  earn: ({ focused }: { focused: boolean }): INativeTabBarIcon =>
    focused
      ? require('@onekeyhq/components/svg/solid/coins.svg')
      : require('@onekeyhq/components/svg/outline/coins.svg'),
  developer: ({ focused }: { focused: boolean }): INativeTabBarIcon =>
    focused
      ? require('@onekeyhq/components/svg/solid/code-brackets.svg')
      : require('@onekeyhq/components/svg/outline/code-brackets.svg'),
};

type IGetTabRouterParams = {
  freezeOnBlur?: boolean;
};

const getDiscoverRouterConfig = (
  params?: IGetTabRouterParams,
  tabBarStyle?: ITabNavigatorConfig<ETabRoutes>['tabBarStyle'],
): ITabNavigatorConfig<ETabRoutes> => ({
  name: ETabRoutes.Discovery,
  rewrite: '/discovery',
  exact: true,
  tabBarIcon: (focused?: boolean) =>
    focused ? 'CompassSolid' : 'CompassOutline',
  nativeTabBarIcon: nativeTabIcons.discover,
  translationId: platformEnv.isNative
    ? ETranslations.global_discover
    : ETranslations.global_browser,
  freezeOnBlur: Boolean(params?.freezeOnBlur),
  children: discoveryRouters,
  tabBarStyle,
  trackId: 'global-browser',
});

export const useTabRouterConfig = (params?: IGetTabRouterParams) => {
  const { md } = useMedia();

  const { isModalStack } = useDeviceManagerModalStyle();
  const isShowDesktopDiscover = platformEnv.isDesktop;
  const isWebDappMode = platformEnv.isWebDappMode;
  const isShowMDDiscover =
    !isShowDesktopDiscover &&
    !platformEnv.isWebDappMode &&
    !platformEnv.isExtensionUiPopup &&
    !(platformEnv.isExtensionUiSidePanel && md);

  const shouldShowMarketTab = !(
    platformEnv.isExtensionUiPopup || platformEnv.isExtensionUiSidePanel
  );

  const { perpDisabled, perpTabShowWeb } = usePerpTabConfig();
  const handleMarketTabPress = useCallback(() => {
    const nav = rootNavigationRef.current;
    if (nav) {
      nav.dispatch(
        CommonActions.navigate({
          name: ETabRoutes.Market,
          params: {
            screen: ETabMarketRoutes.TabMarket,
          },
          pop: true,
        }),
      );
    }
  }, []);

  const referFriendsTabConfig = useMemo(
    () => ({
      name: ETabRoutes.ReferFriends,
      tabBarIcon: (focused?: boolean) =>
        focused ? 'GiftSolid' : 'GiftOutline',
      translationId: ETranslations.sidebar_refer_a_friend,
      rewrite: '/refer-friends',
      exact: true,
      children: referFriendsRouters,
      trackId: 'global-referral',
      freezeOnBlur: Boolean(params?.freezeOnBlur),
    }),
    [params?.freezeOnBlur],
  );

  return useMemo(() => {
    const tabs = [
      {
        name: ETabRoutes.Home,
        tabBarIcon: (focused?: boolean) =>
          focused ? 'Wallet4Solid' : 'Wallet4Outline',
        nativeTabBarIcon: nativeTabIcons.wallet,
        translationId: ETranslations.global_wallet,
        freezeOnBlur: Boolean(params?.freezeOnBlur),
        rewrite: isWebDappMode ? '/wallet' : '/',
        exact: true,
        children: homeRouters,
        trackId: 'global-wallet',
        hiddenIcon: isWebDappMode,
      },
      shouldShowMarketTab
        ? {
            name: ETabRoutes.Market,
            tabBarIcon: (focused?: boolean) =>
              focused ? 'TradingViewCandlesSolid' : 'TradingViewCandlesOutline',
            translationId: ETranslations.global_market,
            freezeOnBlur: Boolean(params?.freezeOnBlur),
            rewrite: '/market',
            exact: true,
            children: marketRouters,
            trackId: 'global-market',
            // Hide Market tab on mobile (merged into Discovery)
            hiddenIcon: platformEnv.isNative,
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
          focused ? 'SwitchHorSolid' : 'SwitchHorOutline',
        nativeTabBarIcon: nativeTabIcons.swap,
        translationId: ETranslations.global_trade,
        freezeOnBlur: Boolean(params?.freezeOnBlur),
        rewrite: '/swap',
        exact: true,
        children: swapRouters,
        trackId: 'global-trade',
      },
      {
        name: ETabRoutes.WebviewPerpTrade,
        tabBarIcon: (focused?: boolean) =>
          focused ? 'TradeSolid' : 'TradeOutline',
        translationId: ETranslations.global_perp,
        nativeTabBarIcon: nativeTabIcons.perp,
        freezeOnBlur: Boolean(params?.freezeOnBlur),
        rewrite: perpTabShowWeb ? '/perps' : undefined,
        exact: true,
        children: perpWebviewRouters,
        trackId: 'global-perp',
        hiddenIcon: perpDisabled || !perpTabShowWeb,
      },
      {
        name: ETabRoutes.Perp,
        tabBarIcon: (focused?: boolean) =>
          focused ? 'TradeSolid' : 'TradeOutline',
        translationId: ETranslations.global_perp,
        nativeTabBarIcon: nativeTabIcons.perp,
        freezeOnBlur: Boolean(params?.freezeOnBlur),
        children: perpRouters,
        rewrite: perpTabShowWeb ? undefined : '/perps',
        exact: true,
        hiddenIcon: perpDisabled || perpTabShowWeb,
        trackId: 'global-perp',
      },
      {
        name: ETabRoutes.Earn,
        tabBarIcon: (focused?: boolean) =>
          focused ? 'CoinsSolid' : 'CoinsOutline',
        translationId: ETranslations.global_earn,
        freezeOnBlur: Boolean(params?.freezeOnBlur),
        rewrite: '/defi',
        exact: true,
        children: earnRouters,
        trackId: 'global-earn',
        hideOnTabBar: platformEnv.isNative,
      },
      platformEnv.isNative
        ? undefined
        : {
            name: ETabRoutes.DeviceManagement,
            tabBarIcon: (focused?: boolean) =>
              focused ? 'PhoneSolid' : 'PhoneOutline',
            translationId: ETranslations.global_device,
            freezeOnBlur: Boolean(params?.freezeOnBlur),
            exact: true,
            children: deviceManagementRouters,
            trackId: 'global-my-onekey',
            hideOnTabBar: isModalStack,
          },
      !platformEnv.isNative ? referFriendsTabConfig : undefined,
      isShowMDDiscover ? getDiscoverRouterConfig(params) : undefined,
      isShowDesktopDiscover ? getDiscoverRouterConfig(params) : undefined,
      platformEnv.isDev
        ? {
            name: ETabRoutes.Developer,
            tabBarIcon: (focused?: boolean) =>
              focused ? 'CodeBracketsSolid' : 'CodeBracketsOutline',
            translationId: ETranslations.global_dev_mode,
            nativeTabBarIcon: nativeTabIcons.developer,
            freezeOnBlur: Boolean(params?.freezeOnBlur),
            rewrite: '/dev',
            exact: true,
            children: developerRouters,
            trackId: 'global-dev',
          }
        : undefined,
    ].filter((i) => !!i);

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
    params,
    isWebDappMode,
    shouldShowMarketTab,
    handleMarketTabPress,
    perpTabShowWeb,
    perpDisabled,
    isModalStack,
    isShowMDDiscover,
    isShowDesktopDiscover,
    referFriendsTabConfig,
  ]) as ITabNavigatorConfig<ETabRoutes>[];
};

export const tabExtraConfig: ITabNavigatorExtraConfig<ETabRoutes> | undefined =
  {
    name: ETabRoutes.MultiTabBrowser,
    children: multiTabBrowserRouters,
  };
