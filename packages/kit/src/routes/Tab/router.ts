import { useMemo } from 'react';

import { getTokenValue, useMedia } from '@onekeyhq/components';
import type {
  ITabNavigatorConfig,
  ITabNavigatorExtraConfig,
} from '@onekeyhq/components/src/layouts/Navigation/Navigator/types';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

import { developerRouters } from '../../views/Developer/router';
import { homeRouters } from '../../views/Home/router';

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
  };
  return discoverRouterConfig;
};

export const useTabRouterConfig = (params?: IGetTabRouterParams) => {
  const { md } = useMedia();

  const isShowDesktopDiscover = useIsShowDesktopDiscover();

  const isShowMDDiscover = useMemo(
    () =>
      !isShowDesktopDiscover &&
      !platformEnv.isExtensionUiPopup &&
      !(platformEnv.isExtensionUiSidePanel && md),
    [isShowDesktopDiscover, md],
  );
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
        },
        {
          name: ETabRoutes.Earn,
          tabBarIcon: (focused?: boolean) =>
            focused ? 'CoinsSolid' : 'CoinsOutline',
          translationId: ETranslations.global_earn,
          freezeOnBlur: Boolean(params?.freezeOnBlur),
          rewrite: '/earn',
          exact: true,
          children: earnRouters,
        },
        {
          name: ETabRoutes.Swap,
          tabBarIcon: (focused?: boolean) =>
            focused ? 'SwitchHorSolid' : 'SwitchHorOutline',
          translationId: ETranslations.global_trade,
          freezeOnBlur: Boolean(params?.freezeOnBlur),
          rewrite: '/swap',
          exact: true,
          children: swapRouters,
        },
        {
          name: ETabRoutes.Market,
          tabBarIcon: (focused?: boolean) =>
            focused ? 'ChartTrendingUp2Solid' : 'ChartTrendingUp2Outline',
          translationId: ETranslations.global_market,
          freezeOnBlur: Boolean(params?.freezeOnBlur),
          rewrite: '/market',
          exact: true,
          children: marketRouters,
        },
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
            }
          : undefined,
        isShowDesktopDiscover
          ? getDiscoverRouterConfig(params, {
              marginTop: getTokenValue('$4', 'size'),
            })
          : undefined,
      ].filter<ITabNavigatorConfig<ETabRoutes>>(
        (i): i is ITabNavigatorConfig<ETabRoutes> => !!i,
      ),
    [isShowDesktopDiscover, isShowMDDiscover, params],
  );
};

export const tabExtraConfig: ITabNavigatorExtraConfig<ETabRoutes> | undefined =
  {
    name: ETabRoutes.MultiTabBrowser,
    children: multiTabBrowserRouters,
  };
