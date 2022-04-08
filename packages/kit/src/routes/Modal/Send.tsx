import React from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';
import SendAuthentication from '@onekeyhq/kit/src/views/Send/Authentication';
import Send from '@onekeyhq/kit/src/views/Send/Send';
import SendConfirm from '@onekeyhq/kit/src/views/Send/SendConfirm';
import { SendConfirmRedirect } from '@onekeyhq/kit/src/views/Send/SendConfirmRedirect';
import SendEditFee from '@onekeyhq/kit/src/views/Send/SendEditFee';
import {
  SendRoutes,
  SendRoutesParams,
} from '@onekeyhq/kit/src/views/Send/types';

import createStackNavigator from './createStackNavigator';

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
    name: SendRoutes.SendConfirmRedirect,
    component: SendConfirmRedirect,
  },
  {
    name: SendRoutes.SendEditFee,
    component: SendEditFee,
  },
  {
    name: SendRoutes.SendAuthentication,
    component: SendAuthentication,
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
