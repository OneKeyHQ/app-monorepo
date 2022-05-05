import React from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';
import SendAuthentication from '@onekeyhq/kit/src/views/Send/Authentication';
import Send from '@onekeyhq/kit/src/views/Send/Send';
import SendConfirm from '@onekeyhq/kit/src/views/Send/SendConfirm';
import { SendConfirmFromDapp } from '@onekeyhq/kit/src/views/Send/SendConfirmFromDapp';
import SendEditFee from '@onekeyhq/kit/src/views/Send/SendEditFee';
import {
  SendRoutes,
  SendRoutesParams,
} from '@onekeyhq/kit/src/views/Send/types';

import { TokenApproveAmountEdit } from '../../views/Send/confirmViews/TokenApproveAmountEdit';
import SignMessageConfirm from '../../views/Send/SignMessageConfirm';
import SwapPreiview from '../../views/Swap/Preview/index';

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
    name: SendRoutes.SendConfirmFromDapp,
    component: SendConfirmFromDapp,
  },
  {
    name: SendRoutes.SendEditFee,
    component: SendEditFee,
  },
  {
    name: SendRoutes.TokenApproveAmountEdit,
    component: TokenApproveAmountEdit,
  },
  {
    name: SendRoutes.SendAuthentication,
    component: SendAuthentication,
  },
  {
    name: SendRoutes.SignMessageConfirm,
    component: SignMessageConfirm,
  },
  {
    name: SendRoutes.SwapPreview,
    component: SwapPreiview,
  },
];

const TransactionStack = () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <SendNavigator.Navigator
      screenOptions={{
        headerShown: false,
        // speedUp and cancel auto navigate with animation is weired, so we disable animation
        animationEnabled: false,
        // animationEnabled: !!isVerticalLayout,
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
