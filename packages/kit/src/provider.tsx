import React, { FC } from 'react';

import { StackActions, useNavigation } from '@react-navigation/native';
import { Provider as ReduxProvider } from 'react-redux';

import {
  Icon,
  Provider,
  useIsRootRoute,
  useThemeValue,
  useUserDevice,
} from '@onekeyhq/components';

import AccountSelector from './components/Header/AccountSelector';
import ChainSelector from './components/Header/ChainSelector';
import useAutoRedirectToRoute from './hooks/useAutoRedirectToRoute';
import { StackNavigator, TabNavigator } from './navigator';
import { RootStackParamList, stackRoutes, tabRoutes } from './routes';
import store from './store';

const StackScreen = ({ index }: { index: number }) => {
  const fontColor = useThemeValue('text-default');
  const bgColor = useThemeValue('surface-subdued');
  const borderColor = useThemeValue('border-subdued');
  const { size } = useUserDevice();
  const { setIsRootRoute } = useIsRootRoute();

  return (
    <StackNavigator.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: bgColor,
          // @ts-expect-error
          borderBottomColor: borderColor,
        },
        headerTintColor: fontColor,
      }}
    >
      <StackNavigator.Screen
        listeners={{
          focus() {
            setIsRootRoute(true);
          },
        }}
        name={tabRoutes[index].name as keyof RootStackParamList}
        component={tabRoutes[index].component}
        options={{
          headerRight: () => <ChainSelector />,
          headerTitle: () => null,
          headerLeft: ['LARGE', 'XLARGE'].includes(size)
            ? undefined
            : () => <AccountSelector />,
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
  const borderColor = useThemeValue('border-subdued');
  const navigation = useNavigation();

  return (
    <TabNavigator.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: bgColor,
          borderBottomColor: borderColor,
        },
        headerShown: false,
        headerTintColor: fontColor,
        // @ts-expect-error
        headerCorner: <AccountSelector />,
      }}
    >
      {tabRoutes.map((tab, index) => (
        <TabNavigator.Screen
          listeners={{
            focus() {
              if (navigation.isFocused() && navigation.canGoBack()) {
                setTimeout(() => {
                  navigation.dispatch(StackActions.popToTop());
                }, 0);
              }
            },
          }}
          key={tab.name}
          component={stackScreensInTab[index]}
          name={tab.name}
          options={{
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
