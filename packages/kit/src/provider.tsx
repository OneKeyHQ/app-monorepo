import React, { FC } from 'react';

import { NavigationContainer } from '@react-navigation/native';
import { Provider as ReduxProvider } from 'react-redux';

import { Layout, Provider } from '@onekeyhq/components';
import LayoutHeader from '@onekeyhq/components/src/Layout/Header';

import AccountSelector from './components/Header/AccountSelector';
import ChainSelector from './components/Header/ChainSelector';
import useAutoRedirectToRoute from './hooks/useAutoRedirectToRoute';
import { StackNavigator } from './navigator';
import { RootStackParamList, stackRoutes, tabRoutes } from './routes';
import store from './store';

const StackScreen = () => (
  <StackNavigator.Navigator>
    {tabRoutes.map((tab) => (
      <StackNavigator.Screen
        key={tab.name}
        name={tab.name as keyof RootStackParamList}
        options={{
          header: () => (
            <LayoutHeader
              headerLeft={() => <AccountSelector />}
              headerRight={() => <ChainSelector />}
            />
          ),
          animation: 'none',
        }}
      >
        {() => (
          <Layout name={tab.name} content={tab.component} tabs={tabRoutes} />
        )}
      </StackNavigator.Screen>
    ))}
    {stackRoutes.map((stack) => (
      <StackNavigator.Screen
        key={stack.name}
        name={stack.name as keyof RootStackParamList}
      >
        {() => (
          <Layout
            name={stack.name}
            content={stack.component}
            tabs={tabRoutes}
          />
        )}
      </StackNavigator.Screen>
    ))}
  </StackNavigator.Navigator>
);

const Router = () => {
  useAutoRedirectToRoute();
  return <StackScreen />;
};

const KitProvider: FC = () => (
  <Provider>
    <ReduxProvider store={store}>
      <NavigationContainer>
        <Router />
      </NavigationContainer>
    </ReduxProvider>
  </Provider>
);

export default KitProvider;
