/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { useIsVerticalLayout } from '@onekeyhq/components';
import { createBottomTabNavigator } from '@onekeyhq/components/src/Layout/BottomTabs';
import { LayoutHeaderMobile } from '@onekeyhq/components/src/Layout/Header/LayoutHeaderMobile';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
import { navigationRef } from '@onekeyhq/kit/src/provider/NavigationProvider';
import { FiatPayRoutes } from '@onekeyhq/kit/src/routes/Modal/FiatPay';
import { ReceiveTokenRoutes } from '@onekeyhq/kit/src/routes/Modal/routes';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/types';
import { SendRoutes } from '@onekeyhq/kit/src/views/Send/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { LazyDisplayView } from '../../components/LazyDisplayView';
import { TabRoutes, TabRoutesParams } from '../types';

import { getStackTabScreen, tabRoutes } from './routes';

const Tab = createBottomTabNavigator<TabRoutesParams>();

const TabNavigator = () => {
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();
  const { network: activeNetwork, wallet } = useActiveWalletAccount();

  const renderHeader = useCallback(() => <LayoutHeaderMobile />, []);

  const foldableList = useMemo(
    () => [
      {
        name: TabRoutes.Swap,
        foldable: true,
        component: () => null,
        disabled: wallet?.type === 'watching',
        onPress: () => {
          // @ts-expect-error
          navigationRef.current?.navigate(TabRoutes.Swap);
        },
        tabBarLabel: intl.formatMessage({ id: 'title__swap' }),
        tabBarIcon: () => 'SwitchHorizontalOutline',
        description: intl.formatMessage({
          id: 'content__exchange_any_tokens',
        }),
        hideInHorizontalLayaout: true,
      },
      {
        name: TabRoutes.Send,
        foldable: true,
        component: () => null,
        disabled: wallet?.type === 'watching',
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
        tabBarIcon: () => 'ArrowUpOutline',
        description: intl.formatMessage({
          id: 'content__transfer_tokens_to_another_wallet',
        }),
      },
      {
        name: TabRoutes.Receive,
        foldable: true,
        component: () => null,
        disabled: wallet?.type === 'watching',
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
        tabBarIcon: () => 'ArrowDownOutline',
        description: intl.formatMessage({
          id: 'content__deposit_tokens_to_your_wallet',
        }),
      },
      {
        foldable: true,
        component: () => null,
        disabled: wallet?.type === 'watching',
        onPress: () => {
          navigationRef.current?.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.FiatPay,
            params: {
              screen: FiatPayRoutes.SupportTokenListModal,
              params: {
                networkId: activeNetwork?.id ?? '',
              },
            },
          });
        },
        tabBarLabel: intl.formatMessage({ id: 'action__buy' }),
        tabBarIcon: () => 'PlusOutline',
        description: intl.formatMessage({
          id: 'content__purchase_crypto_with_cash',
        }),
      },
    ],
    [activeNetwork?.id, intl, wallet?.type],
  );

  const tabRoutesList = useMemo(
    () =>
      tabRoutes.map((tab) => (
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
      )),
    [intl, isVerticalLayout],
  );

  return useMemo(
    () => (
      <LazyDisplayView
        delay={100}
        hideOnUnmount={false}
        isLazyDisabled={platformEnv.isNative}
      >
        <Tab.Navigator
          screenOptions={{
            lazy: true,
            header: renderHeader,
            // @ts-expect-error
            foldableList,
          }}
        >
          {tabRoutesList}
        </Tab.Navigator>
      </LazyDisplayView>
    ),
    [foldableList, renderHeader, tabRoutesList],
  );
};

export default memo(TabNavigator);
