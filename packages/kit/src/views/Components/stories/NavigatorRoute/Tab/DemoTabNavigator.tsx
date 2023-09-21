/* eslint-disable @typescript-eslint/no-unused-vars */
import { useMemo } from 'react';

import { createStackNavigator } from '@onekeyhq/components/src/Navigation';
import { makeHeaderScreenOptions } from '@onekeyhq/components/src/Navigation/Header';
import { createBottomTabNavigator } from '@onekeyhq/components/src/Navigation/Tab/BottomTabs';
import NavigationBar from '@onekeyhq/components/src/Navigation/Tab/TabBar';
import type { ScreensList } from '@onekeyhq/components/src/Navigation/type';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import AppRootTabDeveloper from './Root/DemoTabDeveloper';
import AppRootTabHome from './Root/DemoTabHome';

import type { DemoTabRoutes } from '../Modal/types';
import type { DemoTabRoutesParams } from '../types';
import type { DemoTabRouteConfig } from './DemoTabRouteConfig';

const tabRoutesConfig: DemoTabRouteConfig[] = [
  AppRootTabHome,
  AppRootTabDeveloper,
];

const Tab = createBottomTabNavigator<DemoTabRoutesParams>();

const Stack = createStackNavigator();

export const getStackTabScreen = (tabName: DemoTabRoutes) => {
  const tab = tabRoutesConfig.find(
    (t) => t.name === tabName,
  ) as DemoTabRouteConfig;
  const screens: ScreensList<string> = [
    {
      // fix: Found screens with the same name nested inside one another
      name: tab.name,
      component: tab.component,
      alwaysShowBackButton: false,
      i18nTitle: tab.translationId,
    },
    ...(tab.children || []),
  ];

  const StackNavigatorComponent = () => (
    <Stack.Navigator>
      {screens.map(({ name, component }, index) => (
        // show navigation header
        <Stack.Screen
          key={name}
          name={name}
          component={component}
          // @ts-expect-error
          options={({ navigation }: { navigation: any }) => ({
            key: `${name as string}.Stack.Screen.component`,
            headerShown: true,
            ...makeHeaderScreenOptions({
              isRootScreen: true,
              navigation,
            }),
          })}
        />
      ))}
    </Stack.Navigator>
  );
  return StackNavigatorComponent;
};

const DemoTabNavigator = () => {
  // const intl = useIntl();

  const tabRoutesList = useMemo(
    () =>
      tabRoutesConfig.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={getStackTabScreen(tab.name)}
          options={{
            tabBarIcon: tab.tabBarIcon,
            // tabBarLabel: intl.formatMessage({ id: tab.translationId }),
            tabBarLabel: tab.translationId,
            headerShown: false,
            // TODO not working
            tabBarStyle: { display: 'none', height: 0 },
          }}
        />
      )),
    [],
  );

  return useMemo(
    () => (
      // <LazyDisplayView
      //   delay={100}
      //   hideOnUnmount={false}
      //   isLazyDisabled={platformEnv.isNative}
      // >
      <Tab.Navigator
        tabBar={(props) => <NavigationBar {...props} />}
        screenOptions={{
          // TODO make component content lazy
          // FIXME: lazy causes issues with overlays
          // header: tabNavigatorHeaderRender,
          freezeOnBlur: true,
          lazy: !platformEnv.isNative,
        }}
      >
        {tabRoutesList}
      </Tab.Navigator>
      // </LazyDisplayView>
    ),
    [tabRoutesList],
  );
};

export default DemoTabNavigator;
