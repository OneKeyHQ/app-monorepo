import React from 'react';

import { createStackNavigator } from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';
import Connection from '@onekeyhq/kit/src/views/DappModals/Connection';

export enum DappConnectionModalRoutes {
  ConnectionModal = 'ConnectionModal',
}

export type DappConnectionRoutesParams = {
  [DappConnectionModalRoutes.ConnectionModal]: undefined;
};

const DappConnectionModalNavigator =
  createStackNavigator<DappConnectionRoutesParams>();

const modalRoutes = [
  {
    name: DappConnectionModalRoutes.ConnectionModal,
    component: Connection,
  },
];

const DappConnectionStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <DappConnectionModalNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <DappConnectionModalNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </DappConnectionModalNavigator.Navigator>
  );
};

export default DappConnectionStack;
