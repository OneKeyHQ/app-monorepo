import { getTokenValue } from '@onekeyhq/components';
import type {
  ITabNavigatorConfig,
  ITabNavigatorExtraConfig,
} from '@onekeyhq/components/src/layouts/Navigation/Navigator/types';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import { developerRouters } from '../../views/Developer/router';
import { homeRouters } from '../../views/Home/router';

import { discoveryRouters } from './Discovery/router';
import { marketRouters } from './Marktet/router';
import { meRouters } from './Me/router';
import { multiTabBrowserRouters } from './MultiTabBrowser/router';
import { swapRouters } from './Swap/router';

type IGetTabRouterParams = {
  freezeOnBlur?: boolean;
};

const getDiscoverRouterConfig = (params?: IGetTabRouterParams) => {
  const discoverRouterConfig: ITabNavigatorConfig<ETabRoutes> = {
    name: ETabRoutes.Discovery,
    rewrite: '/discovery',
    exact: true,
    tabBarIcon: (focused?: boolean) =>
      focused ? 'CompassCircleSolid' : 'CompassCircleOutline',
    translationId: ETranslations.global_browser,
    freezeOnBlur: Boolean(params?.freezeOnBlur),
    children: discoveryRouters,
    tabBarStyle: platformEnv.isDesktop
      ? {
          marginTop: getTokenValue('$4', 'size'),
        }
      : undefined,
  };
  return discoverRouterConfig;
};

export const getTabRouter = (params?: IGetTabRouterParams) => {
  const tabRouter: ITabNavigatorConfig<ETabRoutes>[] = [
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
      name: ETabRoutes.Market,
      tabBarIcon: (focused?: boolean) =>
        focused ? 'ChartTrendingUp2Solid' : 'ChartTrendingUp2Outline',
      translationId: ETranslations.global_market,
      freezeOnBlur: Boolean(params?.freezeOnBlur),
      rewrite: '/market',
      exact: true,
      children: marketRouters,
    },
    {
      name: ETabRoutes.Swap,
      tabBarIcon: (focused?: boolean) =>
        focused ? 'SwitchHorSolid' : 'SwitchHorOutline',
      translationId: ETranslations.global_swap,
      freezeOnBlur: Boolean(params?.freezeOnBlur),
      rewrite: '/swap',
      exact: true,
      children: swapRouters,
    },
    !platformEnv.isDesktop ? getDiscoverRouterConfig(params) : undefined,
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
    platformEnv.isDesktop ? getDiscoverRouterConfig(params) : undefined,
  ].filter<ITabNavigatorConfig<ETabRoutes>>(
    (i): i is ITabNavigatorConfig<ETabRoutes> => !!i,
  );
  return tabRouter;
};

export const tabExtraConfig: ITabNavigatorExtraConfig<ETabRoutes> | undefined =
  platformEnv.isDesktop
    ? {
        name: ETabRoutes.MultiTabBrowser,
        children: multiTabBrowserRouters,
      }
    : undefined;
