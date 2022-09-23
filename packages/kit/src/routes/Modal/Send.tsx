import React from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';
import SendAuthentication from '@onekeyhq/kit/src/views/Send/Authentication';
import { PreSendAddress } from '@onekeyhq/kit/src/views/Send/PreSendAddress';
import { PreSendAmount } from '@onekeyhq/kit/src/views/Send/PreSendAmount';
import { PreSendToken } from '@onekeyhq/kit/src/views/Send/PreSendToken';
import SendConfirmModern from '@onekeyhq/kit/src/views/Send/SendConfirm';
import { SendConfirmFromDapp } from '@onekeyhq/kit/src/views/Send/SendConfirmFromDapp';
import SendEditFee from '@onekeyhq/kit/src/views/Send/SendEditFee';
import SendLegacy from '@onekeyhq/kit/src/views/Send/SendLegacy';
import {
  SendRoutes,
  SendRoutesParams,
} from '@onekeyhq/kit/src/views/Send/types';

import { TokenApproveAmountEdit } from '../../views/Send/confirmViews/TokenApproveAmountEdit';
import { SendFeedbackReceipt } from '../../views/Send/SendModals/SendFeedbackReceipt';
import SignMessageConfirm from '../../views/Send/SignMessageConfirm';

import { buildModalStackNavigatorOptions } from './buildModalStackNavigatorOptions';
import createStackNavigator from './createStackNavigator';

const SendNavigator = createStackNavigator<SendRoutesParams>();

// const SendConfirm = SendConfirmLegacy;
const SendConfirm = SendConfirmModern;

const modalRoutes = [
  {
    name: SendRoutes.PreSendToken,
    component: PreSendToken,
  },
  {
    name: SendRoutes.PreSendAddress,
    component: PreSendAddress,
  },
  {
    name: SendRoutes.PreSendAmount,
    component: PreSendAmount,
  },
  {
    name: SendRoutes.SendLegacy,
    component: SendLegacy,
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
    name: SendRoutes.SendFeedbackReceipt,
    component: SendFeedbackReceipt,
  },
  {
    name: SendRoutes.SignMessageConfirm,
    component: SignMessageConfirm,
  },
];

const TransactionStack = () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <SendNavigator.Navigator
      screenOptions={(navInfo) => ({
        ...buildModalStackNavigatorOptions({ isVerticalLayout, navInfo }),
      })}
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
