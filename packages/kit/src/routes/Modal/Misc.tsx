import React from 'react';

import { createStackNavigator } from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';
import CreateWalletScreen from '@onekeyhq/kit/src/views/CreateWallet';

export enum MiscModalRoutes {
  CreateWallet = 'CreateWallet',
}

export type MiscRoutesParams = {
  [MiscModalRoutes.CreateWallet]: undefined;
};

const MiscNavigator = createStackNavigator<MiscRoutesParams>();

const modalRoutes = [
  {
    name: MiscModalRoutes.CreateWallet,
    component: CreateWalletScreen,
  },
];

const MiscModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <MiscNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <MiscNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </MiscNavigator.Navigator>
  );
};

export default MiscModalStack;
