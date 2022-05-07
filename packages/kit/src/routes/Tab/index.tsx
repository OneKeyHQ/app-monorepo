/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { memo, useCallback } from 'react';

import { useIntl } from 'react-intl';

import { createBottomTabNavigator } from '@onekeyhq/components/src/Layout/BottomTabs';
import LayoutHeader from '@onekeyhq/components/src/Layout/Header';
import { LocaleIds } from '@onekeyhq/components/src/locale';
import AccountSelector from '@onekeyhq/kit/src/components/Header/AccountSelector';
import ChainSelector from '@onekeyhq/kit/src/components/Header/ChainSelector';
import DiscoverScreen from '@onekeyhq/kit/src/views/Discover';
import MeScreen from '@onekeyhq/kit/src/views/Me';
import PortfolioScreen from '@onekeyhq/kit/src/views/Portfolio';
import SwapScreen from '@onekeyhq/kit/src/views/Swap';
import HomeScreen from '@onekeyhq/kit/src/views/Wallet';

import { TabRoutes, TabRoutesParams } from '../types';

const Tab = createBottomTabNavigator<TabRoutesParams>();

interface TabRouteConfig {
  name: TabRoutes;
  translationId: LocaleIds;
  component: React.FC;
  tabBarIcon: () => string;
}

export const tabRoutes: TabRouteConfig[] = [
  {
    name: TabRoutes.Home,
    component: HomeScreen,
    tabBarIcon: () => 'Home',
    translationId: 'title__home',
  },
  {
    name: TabRoutes.Swap,
    component: SwapScreen,
    tabBarIcon: () => 'Activity',
    translationId: 'title__swap',
  },
  {
    name: TabRoutes.Discover,
    component: DiscoverScreen,
    tabBarIcon: () => 'Discovery',
    translationId: 'title__explore',
  },
  {
    name: TabRoutes.Me,
    component: MeScreen,
    tabBarIcon: () => 'Menu',
    translationId: 'title__menu',
  },
  ...(() => {
    if (process.env.NODE_ENV !== 'production') {
      return [
        {
          name: TabRoutes.Portfolio,
          component: PortfolioScreen,
          tabBarIcon: () => 'TrendingUpOutline',
          translationId: 'title__portfolio',
        },
      ] as TabRouteConfig[];
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
