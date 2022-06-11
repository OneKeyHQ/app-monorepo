/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { memo, useCallback } from 'react';

import { useIntl } from 'react-intl';

import { createBottomTabNavigator } from '@onekeyhq/components/src/Layout/BottomTabs';
import LayoutHeader from '@onekeyhq/components/src/Layout/Header';
import { LocaleIds } from '@onekeyhq/components/src/locale';
import AccountSelector from '@onekeyhq/kit/src/components/Header/AccountSelector';
import ChainSelector from '@onekeyhq/kit/src/components/Header/ChainSelector';
import DevelopScreen from '@onekeyhq/kit/src/views/Developer';
import DiscoverScreen from '@onekeyhq/kit/src/views/Discover';
import MeScreen from '@onekeyhq/kit/src/views/Me';
import SwapScreen from '@onekeyhq/kit/src/views/Swap';
import HomeScreen from '@onekeyhq/kit/src/views/Wallet';
import OverviewScreen from '@onekeyhq/kit/src/views/Wallet/Overview';

import { TabRoutes, TabRoutesParams } from '../types';

const Tab = createBottomTabNavigator<TabRoutesParams>();

interface TabRouteConfig {
  name: TabRoutes;
  translationId: LocaleIds;
  component: React.FC;
  tabBarIcon: () => string;
}

export const tabRoutes: TabRouteConfig[] = [
  // {
  //   name: TabRoutes.Overview,
  //   component: OverviewScreen,
  //   tabBarIcon: () => 'HomeOutline',
  //   translationId: 'title__home',
  // },
  {
    name: TabRoutes.Home,
    component: HomeScreen,
    tabBarIcon: () => 'NavHomeSolid',
    translationId: 'title__home',
  },
  {
    name: TabRoutes.Swap,
    component: SwapScreen,
    tabBarIcon: () => 'NavActivitySolid',
    translationId: 'title__swap',
  },
  {
    name: TabRoutes.Discover,
    component: DiscoverScreen,
    tabBarIcon: () => 'NavDiscoverySolid',
    translationId: 'title__explore',
  },
  {
    name: TabRoutes.Me,
    component: MeScreen,
    tabBarIcon: () => 'NavMenuSolid',
    translationId: 'title__menu',
  },
  ...(() => {
    if (process.env.NODE_ENV !== 'production') {
      return [
        {
          name: TabRoutes.Developer,
          component: DevelopScreen,
          tabBarIcon: () => 'ChipOutline',
          translationId: 'form__dev_mode',
        },
      ] as unknown as TabRouteConfig[];
    }
    return [];
  })(),
];

const TabNavigator = () => {
  const intl = useIntl();

  const renderHeader = useCallback(
    () => (
      <LayoutHeader
        headerLeft={() => <AccountSelector />}
        headerRight={() => <ChainSelector />}
      />
    ),
    [],
  );

  return (
    <Tab.Navigator
      screenOptions={{
        lazy: true,
        header: renderHeader,
      }}
    >
      {tabRoutes.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          options={{
            tabBarIcon: tab.tabBarIcon,
            tabBarLabel: intl.formatMessage({ id: tab.translationId }),
          }}
        />
      ))}
    </Tab.Navigator>
  );
};

export default memo(TabNavigator);
