/* eslint-disable @typescript-eslint/no-unused-vars */
import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { useIsVerticalLayout } from '@onekeyhq/components';
import { createBottomTabNavigator } from '@onekeyhq/components/src/Layout/BottomTabs';
import { LayoutHeaderMobile } from '@onekeyhq/components/src/Layout/Header/LayoutHeaderMobile';
import { navigationRef } from '@onekeyhq/kit/src/provider/NavigationProvider';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { LazyDisplayView } from '../../components/LazyDisplayView';
import { useNavigationBack } from '../../hooks/useAppNavigation';
import { TabRoutes } from '../types';

import { getStackTabScreen, tabRoutes } from './routes';

import type { TabRoutesParams } from '../types';

const Tab = createBottomTabNavigator<TabRoutesParams>();

const TabNavigator = () => {
  const intl = useIntl();
  const goBack = useNavigationBack();
  const isVerticalLayout = useIsVerticalLayout();

  const renderHeader = useCallback(() => <LayoutHeaderMobile />, []);

  const foldableList = useMemo(
    () => [
      {
        name: TabRoutes.Swap,
        foldable: true,
        component: () => null,
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
    ],
    [intl],
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
