/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { memo, useCallback } from 'react';

import { useIntl } from 'react-intl';

import { useIsVerticalLayout } from '@onekeyhq/components';
import { createBottomTabNavigator } from '@onekeyhq/components/src/Layout/BottomTabs';
import LayoutHeader from '@onekeyhq/components/src/Layout/Header';
import AccountSelector from '@onekeyhq/kit/src/components/Header/AccountSelector';
import ChainSelector from '@onekeyhq/kit/src/components/Header/ChainSelector';
import DiscoverScreen from '@onekeyhq/kit/src/views/Discover';
import MeScreen from '@onekeyhq/kit/src/views/Me';
import PortfolioScreen from '@onekeyhq/kit/src/views/Portfolio';
import SwapScreen from '@onekeyhq/kit/src/views/Swap';
import HomeScreen from '@onekeyhq/kit/src/views/Wallet';

import { TabRoutes, TabRoutesParams } from '../types';

const Tab = createBottomTabNavigator<TabRoutesParams>();

export const tabRoutes = [
  {
    name: TabRoutes.Home,
    component: HomeScreen,
    tabBarIcon: () => 'HomeOutline',
    translationId: 'title__home',
  },
  ...(() => {
    if (process.env.NODE_ENV !== 'production') {
      return [
        {
          name: TabRoutes.Swap,
          component: SwapScreen,
          tabBarIcon: () => 'SwitchHorizontalOutline',
          translationId: 'title__swap',
        },
        {
          name: TabRoutes.Portfolio,
          component: PortfolioScreen,
          tabBarIcon: () => 'TrendingUpOutline',
          translationId: 'title__portfolio',
        },
        {
          name: TabRoutes.Discover,
          component: DiscoverScreen,
          tabBarIcon: () => 'CompassOutline',
          translationId: 'title__explore',
        },
      ];
    }
    return [];
  })(),
  {
    name: TabRoutes.Me,
    component: MeScreen,
    tabBarIcon: () => 'UserOutline',
    translationId: 'title__me',
  },
];

const TabNavigator = () => {
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();

  const renderHeader = useCallback(
    () => (
      <LayoutHeader
        headerLeft={() => (isVerticalLayout ? <AccountSelector /> : null)}
        headerRight={() => <ChainSelector />}
      />
    ),
    [isVerticalLayout],
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
            tabBarBackground: () => <AccountSelector />,
            tabBarIcon: tab.tabBarIcon,
            tabBarLabel: intl.formatMessage({ id: tab.translationId }),
          }}
        />
      ))}
    </Tab.Navigator>
  );
};

export default memo(TabNavigator);
