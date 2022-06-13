/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { useIsVerticalLayout } from '@onekeyhq/components';
import { createBottomTabNavigator } from '@onekeyhq/components/src/Layout/BottomTabs';
import LayoutHeader from '@onekeyhq/components/src/Layout/Header';
import AccountSelector from '@onekeyhq/kit/src/components/Header/AccountSelector';
import ChainSelector from '@onekeyhq/kit/src/components/Header/ChainSelector';

import { TabRoutesParams } from '../types';

import { getStackTabScreen, tabRoutes } from './routes';

const Tab = createBottomTabNavigator<TabRoutesParams>();

const TabNavigator = () => {
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();

  const renderHeader = useCallback(
    () => (
      <LayoutHeader
        headerLeft={() => <AccountSelector />}
        headerRight={() => <ChainSelector />}
      />
    ),
    [],
  );

  return useMemo(
    () => (
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
            component={
              isVerticalLayout ? tab.component : getStackTabScreen(tab.name)
            }
            options={{
              tabBarIcon: tab.tabBarIcon,
              tabBarLabel: intl.formatMessage({ id: tab.translationId }),
            }}
          />
        ))}
      </Tab.Navigator>
    ),
    [renderHeader, intl, isVerticalLayout],
  );
};

export default memo(TabNavigator);
