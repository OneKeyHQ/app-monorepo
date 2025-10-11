import { useMemo } from 'react';

import type {
  ITabNavigatorConfig,
  ITabNavigatorExtraConfig,
} from '@onekeyhq/components/src/layouts/Navigation/Navigator/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import { homeRouters } from '../../views/Home/router';

import { multiTabBrowserRouters } from './MultiTabBrowser/router';

type IGetTabRouterParams = {
  freezeOnBlur?: boolean;
};

export const useTabRouterConfig = (params?: IGetTabRouterParams) => {
  return useMemo(
    () =>
      [
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
        },
        // {
        //   name: ETabRoutes.Market,
        //   tabBarIcon: (focused?: boolean) =>
        //     focused ? 'ChartTrendingUp2Solid' : 'ChartTrendingUp2Outline',
        //   translationId: ETranslations.global_market,
        //   freezeOnBlur: Boolean(params?.freezeOnBlur),
        //   rewrite: '/market',
        //   exact: true,
        //   children: marketRouters,
        //   trackId: 'global-market',
        //   // Only apply custom tab press handler for non-mobile platforms
        //   ...(platformEnv.isDesktop ||
        //   platformEnv.isWeb ||
        //   platformEnv.isExtension
        //     ? { onPressWhenSelected: handleMarketTabPress }
        //     : {}),
        // },
        // {
        //   name: ETabRoutes.Swap,
        //   tabBarIcon: (focused?: boolean) =>
        //     focused ? 'SwapHorSolid' : 'SwapHorOutline',
        //   translationId: ETranslations.global_trade,
        //   freezeOnBlur: Boolean(params?.freezeOnBlur),
        //   rewrite: '/swap',
        //   exact: true,
        //   children: swapRouters,
        //   trackId: 'global-trade',
        // },
        // perpTabShowRes,
        // {
        //   name: ETabRoutes.Earn,
        //   tabBarIcon: (focused?: boolean) =>
        //     focused ? 'CoinsSolid' : 'CoinsOutline',
        //   translationId: ETranslations.global_earn,
        //   freezeOnBlur: Boolean(params?.freezeOnBlur),
        //   rewrite: '/defi',
        //   exact: true,
        //   children: earnRouters,
        //   trackId: 'global-earn',
        // },
        // isShowMyOneKeyOnTabbar
        //   ? {
        //       name: ETabRoutes.ReferFriends,
        //       tabBarIcon: () => 'GiftOutline',
        //       translationId: ETranslations.sidebar_refer_a_friend,
        //       tabbarOnPress: toReferFriendsPage,
        //       children: null,
        //       trackId: 'global-referral',
        //     }
        //   : undefined,
        // isShowMyOneKeyOnTabbar
        //   ? {
        //       name: ETabRoutes.DeviceManagement,
        //       tabBarIcon: () => 'OnekeyDeviceCustom',
        //       translationId: ETranslations.global_my_onekey,
        //       tabbarOnPress: toMyOneKeyModal,
        //       children: null,
        //       trackId: 'global-my-onekey',
        //     }
        //   : undefined,
        // isShowMDDiscover ? getDiscoverRouterConfig(params) : undefined,
        // platformEnv.isDev
        //   ? {
        //       name: ETabRoutes.Me,
        //       rewrite: '/me',
        //       exact: true,
        //       tabBarIcon: (focused?: boolean) =>
        //         focused ? 'LayoutGrid2Solid' : 'LayoutGrid2Outline',
        //       translationId: ETranslations.global_more,
        //       freezeOnBlur: Boolean(params?.freezeOnBlur),
        //       children: meRouters,
        //       trackId: 'global-me',
        //     }
        //   : undefined,
        // platformEnv.isDev
        //   ? {
        //       name: ETabRoutes.Developer,
        //       tabBarIcon: (focused?: boolean) =>
        //         focused ? 'CodeBracketsSolid' : 'CodeBracketsOutline',
        //       translationId: ETranslations.global_dev_mode,
        //       freezeOnBlur: Boolean(params?.freezeOnBlur),
        //       rewrite: '/dev',
        //       exact: true,
        //       children: developerRouters,
        //       trackId: 'global-dev',
        //     }
        //   : undefined,
        // isShowDesktopDiscover
        //   ? getDiscoverRouterConfig(params, {
        //       marginTop: getTokenValue('$4', 'size'),
        //     })
        //   : undefined,
      ].filter((i) => !!i),
    [params],
  ) as ITabNavigatorConfig<ETabRoutes>[];
};

export const tabExtraConfig: ITabNavigatorExtraConfig<ETabRoutes> | undefined =
  {
    name: ETabRoutes.MultiTabBrowser,
    children: multiTabBrowserRouters,
  };
