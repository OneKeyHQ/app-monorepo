import React, { FC } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { useIntl } from 'react-intl';
import { Provider, Icon, useThemeValue } from '@onekeyhq/components';
import { Header } from '@react-navigation/elements';

import { TabNavigator as Tab } from './navigator';

import WalletScreen from './views/Wallet';
import SwapScreen from './views/Swap';
import portfolioScreen from './views/Portfolio';
import DiscoverScreen from './views/Discover';
import SettingsScreen from './views/Settings';

import store from './store';

const TabBar = () => {
  const intl = useIntl();
  const fontColor = useThemeValue('text-subdued');
  const bgColor = useThemeValue('icon-disabled');
  return (
    <Tab.Navigator>
      <Tab.Screen
        name="wallet"
        component={WalletScreen}
        options={{
          headerStyle: {
            backgroundColor: bgColor,
          },
          headerTintColor: fontColor,
          header: ({ layout, options }) => (
            <Header
              {...options}
              layout={layout}
              title={intl.formatMessage({
                id: 'ui-components__sidebar_wallet',
              })}
            />
          ),
          tabBarLabel: intl.formatMessage({
            id: 'ui-components__sidebar_wallet',
          }),
          tabBarIcon: ({ color }) => <Icon name="HomeOutline" color={color} />,
        }}
      />
      <Tab.Screen
        name="swap"
        component={SwapScreen}
        options={{
          headerStyle: {
            backgroundColor: bgColor,
          },
          headerTintColor: fontColor,
          header: ({ layout, options }) => (
            <Header
              {...options}
              layout={layout}
              title={intl.formatMessage({
                id: 'ui-components__sidebar_swap',
              })}
            />
          ),
          tabBarLabel: intl.formatMessage({
            id: 'ui-components__sidebar_swap',
          }),
          tabBarIcon: ({ color }) => (
            <Icon name="SwitchHorizontalOutline" color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="portfolio"
        component={portfolioScreen}
        options={{
          headerStyle: {
            backgroundColor: bgColor,
          },
          headerTintColor: fontColor,
          header: ({ layout, options }) => (
            <Header
              {...options}
              layout={layout}
              title={intl.formatMessage({
                id: 'ui-components__sidebar_portfolio',
              })}
            />
          ),
          tabBarLabel: intl.formatMessage({
            id: 'ui-components__sidebar_portfolio',
          }),
          tabBarIcon: ({ color }) => (
            <Icon name="TrendingUpOutline" color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="discover"
        component={DiscoverScreen}
        options={{
          headerStyle: {
            backgroundColor: bgColor,
          },
          headerTintColor: fontColor,
          header: ({ layout, options }) => (
            <Header
              {...options}
              layout={layout}
              title={intl.formatMessage({
                id: 'ui-components__sidebar_discover',
              })}
            />
          ),
          tabBarLabel: intl.formatMessage({
            id: 'ui-components__sidebar_discover',
          }),
          tabBarIcon: ({ color }) => (
            <Icon name="CompassOutline" color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="settings"
        component={SettingsScreen}
        options={{
          headerStyle: {
            backgroundColor: bgColor,
          },
          headerTintColor: fontColor,
          header: ({ layout, options }) => (
            <Header
              {...options}
              layout={layout}
              title={intl.formatMessage({
                id: 'ui-components__sidebar_settings',
              })}
            />
          ),
          tabBarLabel: intl.formatMessage({
            id: 'ui-components__sidebar_settings',
          }),
          tabBarIcon: ({ color }) => <Icon name="CogOutline" color={color} />,
        }}
      />
    </Tab.Navigator>
  );
};

const KitProvider: FC = ({ children }) => (
  <Provider>
    <ReduxProvider store={store}>
      <TabBar />
      {children}
    </ReduxProvider>
  </Provider>
);

export default KitProvider;
