import React from 'react';

import { createStackNavigator } from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';
import Send from '@onekeyhq/kit/src/views/Send/Send';
import SendConfirm from '@onekeyhq/kit/src/views/Send/SendConfirm';
import SendEditFee from '@onekeyhq/kit/src/views/Send/SendEditFee';
import {
  SendRoutes,
  SendRoutesParams,
} from '@onekeyhq/kit/src/views/Send/types';

const SendNavigator = createStackNavigator<SendRoutesParams>();

const modalRoutes = [
  {
    name: SendRoutes.Send,
    component: Send,
  },
  {
    name: SendRoutes.SendConfirm,
    component: SendConfirm,
  },
  {
    name: SendRoutes.SendEditFee,
    component: SendEditFee,
  },
];

const TransactionStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <SendNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <SendNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </SendNavigator.Navigator>
  );
};

export default TransactionStack;
export type { SendRoutesParams };
export { SendRoutes };
