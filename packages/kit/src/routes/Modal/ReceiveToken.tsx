import React from 'react';

import { createStackNavigator } from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';
import ReceiveQRcode from '@onekeyhq/kit/src/views/Transaction/receiveQRcode';

export enum ReceiveQRCodeModalRoutes {
  ReceiveQRCodeModal = 'ReceiveQRCodeModal',
}

export type ReceiveQRCodeRoutesParams = {
  [ReceiveQRCodeModalRoutes.ReceiveQRCodeModal]: undefined;
};

const ReceiveQRCodeNavigator =
  createStackNavigator<ReceiveQRCodeRoutesParams>();

const modalRoutes = [
  {
    name: ReceiveQRCodeModalRoutes.ReceiveQRCodeModal,
    component: ReceiveQRcode,
  },
];

const ReceiveQRCodeModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <ReceiveQRCodeNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <ReceiveQRCodeNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </ReceiveQRCodeNavigator.Navigator>
  );
};

export default ReceiveQRCodeModalStack;
