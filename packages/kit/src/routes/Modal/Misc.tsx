import React from 'react';

import { createStackNavigator } from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';

import WalletGuideScreen from '../../views/WalletGuide';

export enum MiscModalRoutes {
  WalletGuide = 'WalletGuide',
}

export type MiscRoutesParams = {
  [MiscModalRoutes.WalletGuide]: undefined;
};

const MiscNavigator = createStackNavigator<MiscRoutesParams>();

const modalRoutes = [
  {
    name: MiscModalRoutes.WalletGuide,
    component: WalletGuideScreen,
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
