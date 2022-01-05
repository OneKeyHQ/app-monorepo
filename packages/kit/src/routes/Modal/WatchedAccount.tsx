import React from 'react';

import { createStackNavigator } from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';
import WatchedAccount from '@onekeyhq/kit/src/views/Account/WatchedAccount';

export enum WatchedAccountModalRoutes {
  WatchedAccountModal = 'WatchedAccountForm',
}

export type WatchedAccountRoutesParams = {
  [WatchedAccountModalRoutes.WatchedAccountModal]: undefined;
};

const WatchedAccountNavigator =
  createStackNavigator<WatchedAccountRoutesParams>();

const modalRoutes = [
  {
    name: WatchedAccountModalRoutes.WatchedAccountModal,
    component: WatchedAccount,
  },
];

const WatchedAccountModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <WatchedAccountNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <WatchedAccountNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </WatchedAccountNavigator.Navigator>
  );
};

export default WatchedAccountModalStack;
