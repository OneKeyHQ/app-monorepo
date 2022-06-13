/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { useIsVerticalLayout } from '@onekeyhq/components';
import { createBottomTabNavigator } from '@onekeyhq/components/src/Layout/BottomTabs';
import LayoutHeader from '@onekeyhq/components/src/Layout/Header';
import AccountSelector from '@onekeyhq/kit/src/components/Header/AccountSelector';
import ChainSelector from '@onekeyhq/kit/src/components/Header/ChainSelector';
import { navigationRef } from '@onekeyhq/kit/src/provider/NavigationProvider';
import { ReceiveTokenRoutes } from '@onekeyhq/kit/src/routes/Modal/routes';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/types';
import { SendRoutes } from '@onekeyhq/kit/src/views/Send/types';

import { TabRoutes, TabRoutesParams } from '../types';

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

  const foldableList = useMemo(
    () => [
      {
        name: TabRoutes.Send,
        foldable: true,
        component: () => null,
        onPress: () => {
          navigationRef.current?.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.Send,
            params: {
              screen: SendRoutes.PreSendToken,
              params: {
                from: '',
                to: '',
                amount: '',
              },
            },
          });
        },
        tabBarLabel: intl.formatMessage({ id: 'action__send' }),
        tabBarIcon: () => 'ArrowUpSolid',
      },
      {
        name: TabRoutes.Receive,
        foldable: true,
        component: () => null,
        onPress: () => {
          navigationRef.current?.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.Receive,
            params: {
              screen: ReceiveTokenRoutes.ReceiveToken,
              params: {},
            },
          });
        },
        tabBarLabel: intl.formatMessage({ id: 'action__receive' }),
        tabBarIcon: () => 'ArrowDownSolid',
      },
    ],
    [intl],
  );

  return useMemo(
    () => (
      <Tab.Navigator
        screenOptions={{
          lazy: true,
          header: renderHeader,
          // @ts-expect-error
          foldableList,
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
    [renderHeader, intl, isVerticalLayout, foldableList],
  );
};

export default memo(TabNavigator);
