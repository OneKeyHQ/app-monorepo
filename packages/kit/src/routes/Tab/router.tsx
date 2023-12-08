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

import Browser from '../../views/Discovery/container/Browser/Browser';
import DiscoveryDashboard from '../../views/Discovery/container/Dashboard';
import Swap from '../../views/Swap';
import HomePage from '../../views/Tab/Home/HomePageTabs';

import { galleryScreenList } from './Developer/Gallery';
import DevHome from './Developer/Gallery/DevHome';
import DevHomeStack1 from './Developer/Gallery/DevHomeStack1';
import DevHomeStack2 from './Developer/Gallery/DevHomeStack2';
import { ETabDeveloperRoutes } from './Developer/Routes';
import { ETabDiscoveryRoutes } from './Discovery/Routes';
import { ETabHomeRoutes } from './Home/router';
import { ETabMeRoutes } from './Me/Routes';
import TabMe from './Me/TabMe';
import { EMultiTabBrowserRoutes } from './MultiTabBrowser/Routes';
import { ETabSwapRoutes } from './Swap/Routes';
import { ETabRoutes } from './type';

const discoverRouterConfig: ITabNavigatorConfig<ETabRoutes> = {
  name: ETabRoutes.Discovery,
  rewrite: '/discovery',
  exact: true,
  tabBarIcon: (focused?: boolean) =>
    focused ? 'CompassCircleSolid' : 'CompassCircleOutline',
  translationId: 'title__explore',
  freezeOnBlur: true,
  children: [
    {
      name: ETabDiscoveryRoutes.TabDiscovery,
      rewrite: '/',
      component: platformEnv.isNative ? Browser : DiscoveryDashboard,
      translationId: 'title__explore',
    },
  ],
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
    children: [
      {
        name: ETabHomeRoutes.TabHome,
        component: HomePage,
        translationId: 'wallet__wallet',
      },
    ],
  },
  {
    name: ETabRoutes.Swap,
    tabBarIcon: (focused?: boolean) =>
      focused ? 'SwitchHorSolid' : 'SwitchHorOutline',
    translationId: 'title__swap',
    freezeOnBlur: true,
    rewrite: '/swap',
    exact: true,
    children: [
      {
        name: ETabSwapRoutes.TabSwap,
        component: Swap,
        rewrite: '/',
        translationId: 'title__swap',
      },
    ],
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
    children: [
      {
        rewrite: '/',
        name: ETabMeRoutes.TabMe,
        component: TabMe,
        translationId: 'action__more',
      },
    ],
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
    children: [
      {
        name: ETabDeveloperRoutes.TabDeveloper,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        component: require('./Developer/TabDeveloper').default,
        translationId: 'form__dev_mode',
        rewrite: '/',
      },
      ...galleryScreenList,
      {
        name: ETabDeveloperRoutes.DevHome,
        component: DevHome,
        translationId: 'wallet__wallet',
      },
      {
        name: ETabDeveloperRoutes.DevHomeStack1,
        component: DevHomeStack1,
        translationId: 'wallet__wallet',
      },
      {
        name: ETabDeveloperRoutes.DevHomeStack2,
        component: DevHomeStack2,
        translationId: 'wallet__wallet',
      },
    ],
  },
  platformEnv.isDesktop ? discoverRouterConfig : undefined,
].filter<ITabNavigatorConfig<ETabRoutes>>(
  (i): i is ITabNavigatorConfig<ETabRoutes> => !!i,
);

export const tabExtraConfig: ITabNavigatorExtraConfig<ETabRoutes> | undefined =
  platformEnv.isDesktop
    ? {
        name: ETabRoutes.MultiTabBrowser,
        children: [
          {
            name: EMultiTabBrowserRoutes.MultiTabBrowser,
            component:
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              require('../../views/Discovery/container/Browser/Browser')
                .default,
          },
        ],
      }
    : undefined;
