/* eslint-disable @typescript-eslint/no-unused-vars */
import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { useIsVerticalLayout } from '@onekeyhq/components';
import { createBottomTabNavigator } from '@onekeyhq/components/src/Layout/BottomTabs';
import { LayoutHeaderMobile } from '@onekeyhq/components/src/Layout/Header/LayoutHeaderMobile';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
import { navigationRef } from '@onekeyhq/kit/src/provider/NavigationProvider';
import { FiatPayRoutes } from '@onekeyhq/kit/src/routes/Modal/FiatPay';
import { ReceiveTokenRoutes } from '@onekeyhq/kit/src/routes/Modal/routes';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { LazyDisplayView } from '../../components/LazyDisplayView';
import { useNavigationActions } from '../../hooks';
import { useNavigationBack } from '../../hooks/useAppNavigation';
import { TabRoutes, TabRoutesParams } from '../types';

import { getStackTabScreen, tabRoutes } from './routes';

const Tab = createBottomTabNavigator<TabRoutesParams>();

const TabNavigator = () => {
  const intl = useIntl();
  const goBack = useNavigationBack();
  const isVerticalLayout = useIsVerticalLayout();
  const { sendToken } = useNavigationActions();
  const {
    network: activeNetwork,
    wallet,
    accountId,
    networkId,
  } = useActiveWalletAccount();

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
        tabBarIcon: () => 'ArrowsRightLeftOutline',
        description: intl.formatMessage({
          id: 'content__exchange_any_tokens',
        }),
        hideInHorizontalLayaout: true,
      },
      {
        name: TabRoutes.Market,
        foldable: true,
        component: () => null,
        disabled: wallet?.type === 'watching',
        onPress: () => {
          // @ts-expect-error
          navigationRef.current?.navigate(TabRoutes.Market);
        },
        tabBarLabel: intl.formatMessage({ id: 'title__market' }),
        tabBarIcon: () => 'ChartLineSquareOutline',
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
          // TODO show new standalone empty Modal if accountId is empty, as Send Modal require valid accountId
          sendToken({ accountId, networkId });
        },
        tabBarLabel: intl.formatMessage({ id: 'action__send' }),
        tabBarIcon: () => 'PaperAirplaneOutline',
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
        tabBarIcon: () => 'QrCodeOutline',
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
    [accountId, activeNetwork?.id, intl, networkId, wallet?.type, sendToken],
  );

  const tabRoutesList = useMemo(() => {
    let tabs = tabRoutes;
    if (isVerticalLayout)
      tabs = tabRoutes.filter((t) => t.name !== TabRoutes.Swap);
    return tabs.map((tab) => (
      <Tab.Screen
        key={tab.name}
        name={tab.name}
        component={
          isVerticalLayout ? tab.component : getStackTabScreen(tab.name, goBack)
        }
        options={{
          tabBarIcon: tab.tabBarIcon,
          tabBarLabel: intl.formatMessage({ id: tab.translationId }),
        }}
      />
    ));
  }, [intl, isVerticalLayout, goBack]);

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
            freezeOnBlur: true,
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
