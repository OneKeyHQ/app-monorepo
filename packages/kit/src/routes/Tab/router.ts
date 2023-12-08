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

import { developerRouters } from '../../views/Developer/router';
import { homeRouters } from '../../views/Home/router';

import { discoveryRouters } from './Discovery/router';
import { meRouters } from './Me/router';
import { multiTabBrowserRouters } from './MultiTabBrowser/router';
import { swapRouters } from './Swap/router';
import { ETabRoutes } from './type';

const discoverRouterConfig: ITabNavigatorConfig<ETabRoutes> = {
  name: ETabRoutes.Discovery,
  rewrite: '/discovery',
  exact: true,
  tabBarIcon: (focused?: boolean) =>
    focused ? 'CompassCircleSolid' : 'CompassCircleOutline',
  translationId: 'title__explore',
  freezeOnBlur: true,
  children: discoveryRouters,
  tabBarStyle: platformEnv.isDesktop
    ? {
        marginTop: getTokenValue('$4', 'size'),
      }
    : undefined,
  actionList: [
    {
      items: [
        {
          icon: 'CrossedLargeOutline',
          label: 'Close All Tabs',
          testID: 'tab-list-modal-close-all',
          onPress: () => {
            appEventBus.emit(EAppEventBusNames.CloseAllBrowserTab, undefined);
          },
        },
      ],
    },
  ],
};

export const tabRouter: ITabNavigatorConfig<ETabRoutes>[] = [
  {
    name: ETabRoutes.Home,
    tabBarIcon: (focused?: boolean) =>
      focused ? 'WalletSolid' : 'WalletOutline',
    translationId: 'wallet__wallet',
    freezeOnBlur: true,
    rewrite: '/',
    exact: true,
    children: homeRouters,
  },
  {
    name: ETabRoutes.Swap,
    tabBarIcon: (focused?: boolean) =>
      focused ? 'SwitchHorSolid' : 'SwitchHorOutline',
    translationId: 'title__swap',
    freezeOnBlur: true,
    rewrite: '/swap',
    exact: true,
    children: swapRouters,
  },
  !platformEnv.isDesktop ? discoverRouterConfig : undefined,
  {
    name: ETabRoutes.Me,
    rewrite: '/me',
    exact: true,
    tabBarIcon: (focused?: boolean) =>
      focused ? 'LayoutGrid2Solid' : 'LayoutGrid2Outline',
    translationId: 'action__more',
    freezeOnBlur: true,
    children: meRouters,
  },
  {
    name: ETabRoutes.Developer,
    tabBarIcon: (focused?: boolean) =>
      focused ? 'CodeBracketsSolid' : 'CodeBracketsOutline',
    translationId: 'form__dev_mode',
    freezeOnBlur: true,
    rewrite: '/dev',
    exact: true,
    // disable: process.env.NODE_ENV === 'production',
    children: developerRouters,
  },
  platformEnv.isDesktop ? discoverRouterConfig : undefined,
].filter<ITabNavigatorConfig<ETabRoutes>>(
  (i): i is ITabNavigatorConfig<ETabRoutes> => !!i,
);

export const tabExtraConfig: ITabNavigatorExtraConfig<ETabRoutes> | undefined =
  platformEnv.isDesktop
    ? {
        name: ETabRoutes.MultiTabBrowser,
        children: multiTabBrowserRouters,
      }
    : undefined;
