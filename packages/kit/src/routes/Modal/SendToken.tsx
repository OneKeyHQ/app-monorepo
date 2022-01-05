import React from 'react';

import { createStackNavigator } from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';
import Transaction from '@onekeyhq/kit/src/views/Transaction/transaction';

export enum SendTokenModalRoutes {
  SendTokenModal = 'SendTokenModal',
}

export type SendTokenRoutesParams = {
  [SendTokenModalRoutes.SendTokenModal]: undefined;
};

const ReceiveQRCodeNavigator = createStackNavigator<SendTokenRoutesParams>();

const modalRoutes = [
  {
    name: SendTokenModalRoutes.SendTokenModal,
    component: Transaction,
  },
];

const SendTokenModalStack = () => {
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

export default SendTokenModalStack;
