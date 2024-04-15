import { getTokenValue } from '@onekeyhq/components';
import type {
  ITabNavigatorConfig,
  ITabNavigatorExtraConfig,
} from '@onekeyhq/components/src/layouts/Navigation/Navigator/types';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import { developerRouters } from '../../views/Developer/router';
import { homeRouters } from '../../views/Home/router';

import { discoveryRouters } from './Discovery/router';
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
    translationId: 'title__explore',
    freezeOnBlur: Boolean(params?.freezeOnBlur),
    children: discoveryRouters,
    tabBarStyle: platformEnv.isDesktop
      ? {
          marginTop: getTokenValue('$4', 'size'),
        }
      : undefined,
    actionList: platformEnv.isDesktop
      ? [
          {
            items: [
              {
                icon: 'CrossedLargeOutline',
                label: 'Close All Tabs',
                testID: 'tab-list-modal-close-all',
                onPress: () => {
                  appEventBus.emit(
                    EAppEventBusNames.CloseAllBrowserTab,
                    undefined,
                  );
                },
              },
            ],
          },
        ]
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
      translationId: 'wallet__wallet',
      freezeOnBlur: Boolean(params?.freezeOnBlur),
      rewrite: '/',
      exact: true,
      children: homeRouters,
    },
    {
      name: ETabRoutes.Swap,
      tabBarIcon: (focused?: boolean) =>
        focused ? 'SwitchHorSolid' : 'SwitchHorOutline',
      translationId: 'title__swap',
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
          translationId: 'action__more',
          freezeOnBlur: Boolean(params?.freezeOnBlur),
          children: meRouters,
        }
      : undefined,
    platformEnv.isDev
      ? {
          name: ETabRoutes.Developer,
          tabBarIcon: (focused?: boolean) =>
            focused ? 'CodeBracketsSolid' : 'CodeBracketsOutline',
          translationId: 'form__dev_mode',
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
