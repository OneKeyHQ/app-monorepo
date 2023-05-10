/* eslint-disable @typescript-eslint/no-unused-vars */
import { memo, useCallback, useMemo } from 'react';

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useIntl } from 'react-intl';

import { useIsVerticalLayout, useThemeValue } from '@onekeyhq/components';
import { createBottomTabNavigator } from '@onekeyhq/components/src/Layout/BottomTabs';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { LazyDisplayView } from '../../../../components/LazyDisplayView';
import { TabRoutes } from '../../../routesEnum';
import { buildAppRootTabName } from '../../../routesUtils';

import { tabRoutes } from './routes/tabRoutes';
import {
  buildTabNavigatorHeaderRender,
  buildTabScreenHeaderRender,
} from './tabNavHeader';

import type {
  ScreensList,
  TabRouteConfig,
  TabRoutesParams,
} from '../../../types';

const Tab = createBottomTabNavigator<TabRoutesParams>();

const Stack = createNativeStackNavigator();

export const getStackTabScreen = (
  tabName: TabRoutes,
  isVerticalLayout: boolean,
) => {
  const tab = tabRoutes.find((t) => t.name === tabName) as TabRouteConfig;
  const screens: ScreensList<string> = [
    {
      // fix: Found screens with the same name nested inside one another
      name: buildAppRootTabName(tab.name),
      component: tab.component,
      alwaysShowBackButton: false,
      i18nTitle: tab.translationId,
    },
    ...(tab.children || []),
  ];

  const StackNavigatorComponent = () => {
    const [bgColor, borderBottomColor] = useThemeValue([
      'background-default',
      'border-subdued',
    ]);
    return (
      <Stack.Navigator>
        {screens.map(({ name, component, ...stackOptions }, index) => {
          const { headerShown, headerRender } = buildTabScreenHeaderRender({
            tab,
            index,
            name,
            i18nTitle: stackOptions.i18nTitle,
            stackOptions,
            bgColor,
            borderBottomColor,
            isVerticalLayout,
          });

          return (
            // show navigation header
            <Stack.Screen
              key={name}
              name={name}
              component={component}
              options={{
                header: headerRender,
                headerShown,
              }}
            />
          );
        })}
      </Stack.Navigator>
    );
  };

  return StackNavigatorComponent;
};

const TabNavigator = () => {
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();

  const tabNavigatorHeaderRender = useMemo(
    () => buildTabNavigatorHeaderRender(),
    [],
  );

  const tabRoutesList = useMemo(() => {
    let tabs = tabRoutes;
    if (isVerticalLayout && !platformEnv.isNewRouteMode)
      tabs = tabRoutes.filter((t) => t.name !== TabRoutes.Swap);
    return tabs.map((tab) => (
      <Tab.Screen
        key={tab.name}
        name={tab.name}
        component={
          platformEnv.isNewRouteMode || !isVerticalLayout
            ? getStackTabScreen(tab.name, isVerticalLayout)
            : tab.component
        }
        options={{
          tabBarIcon: tab.tabBarIcon,
          tabBarLabel: intl.formatMessage({ id: tab.translationId }),
          // TODO not working
          tabBarStyle: { display: 'none', height: 0 },
        }}
      />
    ));
  }, [intl, isVerticalLayout]);

  return useMemo(
    () => (
      <LazyDisplayView
        delay={100}
        hideOnUnmount={false}
        isLazyDisabled={platformEnv.isNative}
      >
        <Tab.Navigator
          screenOptions={{
            // TODO make component content lazy
            // FIXME: lazy causes issues with overlays
            header: tabNavigatorHeaderRender,
            freezeOnBlur: true,
            lazy: !platformEnv.isNative,
          }}
        >
          {tabRoutesList}
        </Tab.Navigator>
      </LazyDisplayView>
    ),
    [tabNavigatorHeaderRender, tabRoutesList],
  );
};

export default memo(TabNavigator);
