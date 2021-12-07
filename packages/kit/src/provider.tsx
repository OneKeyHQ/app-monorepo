import React, { FC } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import {
  Provider,
  Icon,
  useThemeValue,
  useUserDevice,
} from '@onekeyhq/components';

import { TabNavigator, StackNavigator, RootStackParamList } from './navigator';

import { tabRoutes, stackRoutes } from './routes';
import store from './store';

const TabBarScreen = () => {
  const fontColor = useThemeValue('text-default');
  const bgColor = useThemeValue('surface-subdued');
  const { size } = useUserDevice();
  const isDesktopMode = !['SMALL', 'NORMAL'].includes(size);

  return (
    <TabNavigator.Navigator>
      {tabRoutes.map((tab, index) => (
        <TabNavigator.Screen
          key={tab.name}
          component={
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            index === 0 && isDesktopMode ? StackScreen : tab.component
          }
          name={tab.name}
          options={{
            headerStyle: {
              backgroundColor: bgColor,
            },
            headerTintColor: fontColor,
            headerShown: !(index === 0 && isDesktopMode),
            tabBarIcon: ({ color }) => <Icon name={tab.icon} color={color} />,
          }}
        />
      ))}
    </TabNavigator.Navigator>
  );
};

const StackScreen = () => {
  const fontColor = useThemeValue('text-default');
  const bgColor = useThemeValue('surface-subdued');
  const { size } = useUserDevice();
  const isDesktopMode = !['SMALL', 'NORMAL'].includes(size);

  return (
    <StackNavigator.Navigator>
      {isDesktopMode ? (
        <StackNavigator.Screen
          name={tabRoutes[0].name as keyof RootStackParamList}
          component={tabRoutes[0].component}
          options={{
            headerStyle: {
              backgroundColor: bgColor,
            },
            headerTintColor: fontColor,
          }}
        />
      ) : (
        <StackNavigator.Screen
          name={tabRoutes[0].name as keyof RootStackParamList}
          component={TabBarScreen}
          options={{
            headerShown: false,
            headerStyle: {
              backgroundColor: bgColor,
            },
            headerTintColor: fontColor,
          }}
        />
      )}

      {stackRoutes.map((stack) => (
        <StackNavigator.Screen
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

const Router = () => {
  const { size } = useUserDevice();
  if (['SMALL', 'NORMAL'].includes(size)) return <StackScreen />;
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
