import React from 'react';

import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useThemeValue } from '@onekeyhq/components';
import { LocaleIds } from '@onekeyhq/components/src/locale';
import AddressBook from '@onekeyhq/kit/src/views/AddressBook/Listing';
import DevelopScreen from '@onekeyhq/kit/src/views/Developer';
import DiscoverScreen from '@onekeyhq/kit/src/views/Discover';
import DAppList from '@onekeyhq/kit/src/views/Discover/DAppList';
import { Discover } from '@onekeyhq/kit/src/views/Discover/Home';
import OnekeyLiteDetail from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/Detail';
import MeScreen from '@onekeyhq/kit/src/views/Me';
import VolumeHaptic from '@onekeyhq/kit/src/views/Me/GenaralSection/VolumeHaptic';
import CloudBackup from '@onekeyhq/kit/src/views/Me/SecuritySection/CloudBackup';
import CloudBackupDetails from '@onekeyhq/kit/src/views/Me/SecuritySection/CloudBackup/BackupDetails';
import CloudBackupPreviousBackups from '@onekeyhq/kit/src/views/Me/SecuritySection/CloudBackup/PreviousBackups';
import Protected from '@onekeyhq/kit/src/views/Protected';
import SwapScreen from '@onekeyhq/kit/src/views/Swap';
import SwapHistory from '@onekeyhq/kit/src/views/Swap/History';
import TokenDetail from '@onekeyhq/kit/src/views/TokenDetail';
import HomeScreen from '@onekeyhq/kit/src/views/Wallet';
import Webview from '@onekeyhq/kit/src/views/Webview';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import FullTokenList from '../../views/FullTokenList/FullTokenList';
import renderCustomSubStackHeader from '../Stack/Header';
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
    tabBarIcon: () => 'CreditCardOutline',
    translationId: 'form__account',
    children: [
      {
        name: HomeRoutes.ScreenTokenDetail,
        component: TokenDetail,
      },
      {
        name: HomeRoutes.FullTokenListScreen,
        component: FullTokenList,
      },
    ],
  },
  {
    name: TabRoutes.Swap,
    component: SwapScreen,
    tabBarIcon: () => 'ChartSquareLineOutline',
    translationId: 'title__swap',
    children: [
      {
        name: HomeRoutes.SwapHistory,
        component: SwapHistory,
      },
    ],
  },
  {
    name: TabRoutes.Discover,
    component: DiscoverScreen,
    tabBarIcon: () => 'CompassOutline',
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
    ],
  },
  {
    name: TabRoutes.Me,
    component: MeScreen,
    tabBarIcon: () => 'MenuOutline',
    translationId: 'title__menu',
    children: [
      {
        name: HomeRoutes.ScreenOnekeyLiteDetail,
        component: OnekeyLiteDetail,
      },
      {
        name: HomeRoutes.Protected,
        component: Protected,
      },
      {
        name: HomeRoutes.AddressBook,
        component: AddressBook,
      },
      {
        name: HomeRoutes.VolumeHaptic,
        component: VolumeHaptic,
      },
      {
        name: HomeRoutes.SettingsWebviewScreen,
        component: Webview,
      },
      {
        name: HomeRoutes.CloudBackup,
        component: CloudBackup,
      },
      {
        name: HomeRoutes.CloudBackupPreviousBackups,
        component: CloudBackupPreviousBackups,
      },
      {
        name: HomeRoutes.CloudBackupDetails,
        component: CloudBackupDetails,
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

  const StackNavigatorComponent = () => {
    const [bgColor, textColor, borderBottomColor] = useThemeValue([
      'background-default',
      'text-default',
      'border-subdued',
    ]);
    return (
      <Stack.Navigator
        screenOptions={{
          headerBackTitle: '',
          headerTitleAlign: 'center',
          headerStyle: {
            backgroundColor: bgColor,
            // @ts-expect-error
            borderBottomWidth: 0,
            shadowColor: borderBottomColor,
          },
          header: platformEnv.isNativeIOS
            ? renderCustomSubStackHeader
            : undefined,
          headerTintColor: textColor,
        }}
      >
        {screens.map((s, index) => (
          <Stack.Group key={s.name} screenOptions={{ headerShown: index > 0 }}>
            <Stack.Screen name={s.name} component={s.component} />
          </Stack.Group>
        ))}
      </Stack.Navigator>
    );
  };

  return StackNavigatorComponent;
};
