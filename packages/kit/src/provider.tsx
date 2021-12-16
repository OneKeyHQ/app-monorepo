import React, { FC } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import {
  Icon,
  Provider,
  useIsRootRoute,
  useThemeValue,
} from '@onekeyhq/components';
import { StackNavigator, TabNavigator } from './navigator';

import { stackRoutes, tabRoutes, RootStackParamList } from './routes';
import store from './store';
import useAutoRedirectToRoute from './hooks/useAutoRedirectToRoute';

const StackScreen = ({ index }: { index: number }) => {
  const fontColor = useThemeValue('text-default');
  const bgColor = useThemeValue('surface-subdued');
  const { setIsRootRoute } = useIsRootRoute();

  return (
    <StackNavigator.Navigator>
      <StackNavigator.Screen
        listeners={{
          focus() {
            setIsRootRoute(true);
          },
        }}
        name={tabRoutes[index].name as keyof RootStackParamList}
        component={tabRoutes[index].component}
        options={{
          headerStyle: {
            backgroundColor: bgColor,
          },
          headerTintColor: fontColor,
        }}
      />

      {stackRoutes.map((stack) => (
        <StackNavigator.Screen
          listeners={{
            focus() {
              setIsRootRoute(false);
            },
          }}
          key={stack.name}
          name={stack.name as keyof RootStackParamList}
          component={stack.component}
          options={{
            headerStyle: {
              backgroundColor: bgColor,
            },
            headerTintColor: fontColor,
          }}
        />
      ))}
    </StackNavigator.Navigator>
  );
};

const stackScreensInTab = tabRoutes.map((tab, index) => {
  const StackScreenInTab = () => <StackScreen index={index} />;
  StackScreenInTab.displayName = `${tab.name}StackScreen`;
  return StackScreenInTab;
});

const TabBarScreen = () => {
  const fontColor = useThemeValue('text-default');
  const bgColor = useThemeValue('surface-subdued');

  return (
    <TabNavigator.Navigator>
      {tabRoutes.map((tab, index) => (
        <TabNavigator.Screen
          key={tab.name}
          component={stackScreensInTab[index]}
          name={tab.name}
          options={{
            headerStyle: {
              backgroundColor: bgColor,
            },
            headerTintColor: fontColor,
            headerShown: false,
            tabBarIcon: ({ color }) => <Icon name={tab.icon} color={color} />,
          }}
        />
      ))}
    </TabNavigator.Navigator>
  );
};

const Router = () => {
  useAutoRedirectToRoute();
  return <TabBarScreen />;
};

const KitProvider: FC = () => (
  <Provider>
    <ReduxProvider store={store}>
      <Router />
    </ReduxProvider>
  </Provider>
);

export default KitProvider;
