/* eslint-disable @typescript-eslint/no-unused-vars */
import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { useIsVerticalLayout } from '@onekeyhq/components';
import { createBottomTabNavigator } from '@onekeyhq/components/src/Layout/BottomTabs';
import { LayoutHeaderMobile } from '@onekeyhq/components/src/Layout/Header/LayoutHeaderMobile';
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
            freezeOnBlur: true,
          }}
        >
          {tabRoutesList}
        </Tab.Navigator>
      </LazyDisplayView>
    ),
    [renderHeader, tabRoutesList],
  );
};

export default memo(TabNavigator);
