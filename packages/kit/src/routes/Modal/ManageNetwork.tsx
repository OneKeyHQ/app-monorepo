import React from 'react';

import { createStackNavigator } from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';
import ManageNetworks from '@onekeyhq/kit/src/views/ManageNetworks';

export enum ManageNetworkModalRoutes {
  ManageNetworkModal = 'ManageNetworkModal',
}

export type ManageNetworkRoutesParams = {
  [key in ManageNetworkModalRoutes]: undefined;
};

const ManageNetworkNavigator =
  createStackNavigator<ManageNetworkRoutesParams>();

const modalRoutes = [
  {
    name: ManageNetworkModalRoutes.ManageNetworkModal,
    component: ManageNetworks,
  },
];

const ManageNetworkModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <ManageNetworkNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <ManageNetworkNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </ManageNetworkNavigator.Navigator>
  );
};

export default ManageNetworkModalStack;
