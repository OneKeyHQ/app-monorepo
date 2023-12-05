import { getTokenValue } from 'tamagui';

import { TabStackNavigator } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
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
import { ETabDeveloperRoutes } from './Developer/Routes';
import { ETabDiscoveryRoutes } from './Discovery/Routes';
import { ETabHomeRoutes } from './Home/Routes';
import TabHomeStack1 from './Home/TabHomeStack1';
import TabHomeStack2 from './Home/TabHomeStack2';
import { ETabMeRoutes } from './Me/Routes';
import TabMe from './Me/TabMe';
import { EMultiTabBrowserRoutes } from './MultiTabBrowser/Routes';
import { ETabRoutes } from './Routes';
import { ETabSwapRoutes } from './Swap/Routes';

const discoverRouteConfig: ITabNavigatorConfig<ETabRoutes> = {
  name: ETabRoutes.Discovery,
  tabBarIcon: (focused?: boolean) =>
    focused ? 'CompassCircleSolid' : 'CompassCircleOutline',
  translationId: 'title__explore',
  freezeOnBlur: true,
  children: [
    {
      name: ETabDiscoveryRoutes.TabDiscovery,
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

const config: ITabNavigatorConfig<ETabRoutes>[] = [
  {
    name: ETabRoutes.Home,
    tabBarIcon: (focused?: boolean) =>
      focused ? 'WalletSolid' : 'WalletOutline',
    translationId: 'wallet__wallet',
    freezeOnBlur: true,
    children: [
      {
        name: ETabHomeRoutes.TabHome,
        component: HomePage,
        translationId: 'wallet__wallet',
      },
      {
        name: ETabHomeRoutes.TabHomeStack1,
        component: TabHomeStack1,
        translationId: 'wallet__wallet',
      },
      {
        name: ETabHomeRoutes.TabHomeStack2,
        component: TabHomeStack2,
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
    children: [
      {
        name: ETabSwapRoutes.TabSwap,
        component: Swap,
        translationId: 'title__swap',
      },
    ],
  },
  !platformEnv.isDesktop ? discoverRouteConfig : undefined,
  {
    name: ETabRoutes.Me,
    tabBarIcon: (focused?: boolean) =>
      focused ? 'LayoutGrid2Solid' : 'LayoutGrid2Outline',
    translationId: 'action__more',
    freezeOnBlur: true,
    children: [
      {
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
    // disable: process.env.NODE_ENV === 'production',
    children: [
      {
        name: ETabDeveloperRoutes.TabDeveloper,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        component: require('./Developer/TabDeveloper').default,
        translationId: 'form__dev_mode',
      },
      ...galleryScreenList,
    ],
  },
  platformEnv.isDesktop ? discoverRouteConfig : undefined,
].filter<ITabNavigatorConfig<ETabRoutes>>(
  (i): i is ITabNavigatorConfig<ETabRoutes> => !!i,
);

const extraConfig: ITabNavigatorExtraConfig<ETabRoutes> | undefined =
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

export default function TabNavigator() {
  return (
    <TabStackNavigator<ETabRoutes> config={config} extraConfig={extraConfig} />
  );
}
