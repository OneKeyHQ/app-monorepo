import React from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';
import OverviewAllCrypto from '@onekeyhq/kit/src/views/Overview/OverviewAllCrypto';

import createStackNavigator from './createStackNavigator';

export enum OverviewAllCryptoRoutes {
  OverviewAllCryptoScreen = 'OverviewAllCryptoScreen',
}

export type OverviewAllCryptoRoutesParams = {
  [OverviewAllCryptoRoutes.OverviewAllCryptoScreen]: {
    tokens: any[];
    onPress: (token: any) => void;
  };
};

const AllCryptoNavigator =
  createStackNavigator<OverviewAllCryptoRoutesParams>();
const modalRoutes = [
  {
    name: OverviewAllCryptoRoutes.OverviewAllCryptoScreen,
    component: OverviewAllCrypto,
  },
];

const AllCryptoModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <AllCryptoNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <AllCryptoNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </AllCryptoNavigator.Navigator>
  );
};

export default AllCryptoModalStack;
