import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { LocaleIds } from '@onekeyhq/components/src/locale';
import DevelopScreen from '@onekeyhq/kit/src/views/Developer';
import DiscoverScreen from '@onekeyhq/kit/src/views/Discover';
import DAppList from '@onekeyhq/kit/src/views/Discover/DAppList';
import { Discover } from '@onekeyhq/kit/src/views/Discover/Home';
import FaceID from '@onekeyhq/kit/src/views/FaceID';
import OnekeyLiteDetail from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/Detail';
import MeScreen from '@onekeyhq/kit/src/views/Me';
import SwapScreen from '@onekeyhq/kit/src/views/Swap';
import TokenDetail from '@onekeyhq/kit/src/views/TokenDetail';
import TransactionHistory from '@onekeyhq/kit/src/views/TransactionHistory';
import HomeScreen from '@onekeyhq/kit/src/views/Wallet';
import Webview from '@onekeyhq/kit/src/views/Webview';

import { HomeRoutes, TabRoutes } from '../types';

export interface TabRouteConfig {
  name: TabRoutes;
  translationId: LocaleIds;
  component: React.FC;
  tabBarIcon: () => string;
  children?: {
    name: HomeRoutes;
    component: React.FC<any>;
  }[];
}

export const tabRoutes: TabRouteConfig[] = [
  {
    name: TabRoutes.Home,
    component: HomeScreen,
    tabBarIcon: () => 'NavHomeSolid',
    translationId: 'title__home',
    children: [
      {
        name: HomeRoutes.ScreenTokenDetail,
        component: TokenDetail,
      },
    ],
  },
  {
    name: TabRoutes.Swap,
    component: SwapScreen,
    tabBarIcon: () => 'NavActivitySolid',
    translationId: 'title__swap',
    children: [
      {
        name: HomeRoutes.TransactionHistoryScreen,
        component: TransactionHistory,
      },
    ],
  },
  {
    name: TabRoutes.Discover,
    component: DiscoverScreen,
    tabBarIcon: () => 'NavDiscoverySolid',
    translationId: 'title__explore',
    children: [
      {
        name: HomeRoutes.ExploreScreen,
        component: Discover,
      },
      {
        name: HomeRoutes.DAppListScreen,
        component: DAppList,
      },
      {
        name: HomeRoutes.SettingsWebviewScreen,
        component: Webview,
      },
    ],
  },
  {
    name: TabRoutes.Me,
    component: MeScreen,
    tabBarIcon: () => 'NavMenuSolid',
    translationId: 'title__menu',
    children: [
      {
        name: HomeRoutes.ScreenOnekeyLiteDetail,
        component: OnekeyLiteDetail,
      },
      {
        name: HomeRoutes.FaceId,
        component: FaceID,
      },
    ],
  },
];

if (process.env.NODE_ENV !== 'production') {
  tabRoutes.push({
    name: TabRoutes.Developer,
    component: DevelopScreen,
    tabBarIcon: () => 'ChipOutline',
    translationId: 'form__dev_mode',
  });
}

const Stack = createNativeStackNavigator();

export const getStackTabScreen = (tabName: TabRoutes) => {
  const tab = tabRoutes.find((t) => t.name === tabName) as TabRouteConfig;
  const screens = [
    {
      // fix: Found screens with the same name nested inside one another
      name: `tab-${tab.name}`,
      component: tab.component,
    },
    ...(tab.children || []),
  ];

  const StackNavigatorComponent = () => (
    <Stack.Navigator>
      {screens.map((s, index) => (
        <Stack.Group key={s.name} screenOptions={{ headerShown: index > 0 }}>
          <Stack.Screen name={s.name} component={s.component} />
        </Stack.Group>
      ))}
    </Stack.Navigator>
  );

  return StackNavigatorComponent;
};
