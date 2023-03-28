import { useIsVerticalLayout } from '@onekeyhq/components';

import { BaseSendRouteScreen } from '../../../views/Send/components/BaseSendRouteScreen';
import { BatchSendConfirm } from '../../../views/Send/modals/BatchSendConfirm';
import { BatchSendProgress } from '../../../views/Send/modals/BatchSendProgress';
import { HardwareSwapContinue } from '../../../views/Send/modals/HardwareSwapContinue';
import { PreSendAddress } from '../../../views/Send/modals/PreSendAddress';
import { PreSendAmount } from '../../../views/Send/modals/PreSendAmount';
import { PreSendToken } from '../../../views/Send/modals/PreSendToken';
import { SendAuthentication } from '../../../views/Send/modals/SendAuthentication';
import { SendConfirm } from '../../../views/Send/modals/SendConfirm';
import { SendConfirmFromDapp } from '../../../views/Send/modals/SendConfirmFromDapp';
import { SendEditFee } from '../../../views/Send/modals/SendEditFee';
import { SendFeedbackReceipt } from '../../../views/Send/modals/SendFeedbackReceipt';
import { SendSpecialWarning } from '../../../views/Send/modals/SendSpecialWarning';
import { SignMessageConfirm } from '../../../views/Send/modals/SignMessageConfirm';
import { TokenApproveAmountEdit } from '../../../views/Send/modals/TokenApproveAmountEdit';
import { SendModalRoutes } from '../../../views/Send/types';
import { TransactionSendContextProvider } from '../../../views/Send/utils/TransactionSendContext';

import { buildModalStackNavigatorOptions } from './buildModalStackNavigatorOptions';
import createStackNavigator from './createStackNavigator';

import type { SendRoutesParams } from '../../../views/Send/types';

const SendNavigator = createStackNavigator<SendRoutesParams>();

const modalRoutes = [
  {
    name: SendModalRoutes.PreSendToken,
    // component: PreSendToken,
    component: BaseSendRouteScreen.wrap(PreSendToken, 'action__send'),
  },
  {
    name: SendModalRoutes.PreSendAddress,
    component: BaseSendRouteScreen.wrap(PreSendAddress),
  },
  {
    name: SendModalRoutes.PreSendAmount,
    component: BaseSendRouteScreen.wrap(PreSendAmount),
  },
  {
    name: SendModalRoutes.SignMessageConfirm,
    component: BaseSendRouteScreen.wrap(SignMessageConfirm),
  },
  {
    name: SendModalRoutes.SendConfirmFromDapp,
    // BaseSendRouteScreen.wrap
    component: SendConfirmFromDapp, // DO NOT wrap SendConfirmFromDapp
  },
  {
    name: SendModalRoutes.SendConfirm,
    component: BaseSendRouteScreen.wrap(SendConfirm),
  },
  {
    name: SendModalRoutes.BatchSendConfirm,
    component: BaseSendRouteScreen.wrap(BatchSendConfirm),
  },
  {
    name: SendModalRoutes.BatchSendProgress,
    component: BaseSendRouteScreen.wrap(BatchSendProgress),
  },
  {
    name: SendModalRoutes.SendEditFee,
    component: BaseSendRouteScreen.wrap(SendEditFee),
  },
  {
    name: SendModalRoutes.TokenApproveAmountEdit,
    component: BaseSendRouteScreen.wrap(TokenApproveAmountEdit),
  },
  {
    name: SendModalRoutes.SendSpecialWarning,
    component: BaseSendRouteScreen.wrap(SendSpecialWarning),
  },
  {
    name: SendModalRoutes.SendAuthentication,
    component: BaseSendRouteScreen.wrap(SendAuthentication),
  },
  {
    name: SendModalRoutes.SendFeedbackReceipt,
    component: BaseSendRouteScreen.wrap(SendFeedbackReceipt),
  },
  {
    name: SendModalRoutes.HardwareSwapContinue,
    component: BaseSendRouteScreen.wrap(HardwareSwapContinue),
  },
];

const TransactionStack = () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <TransactionSendContextProvider>
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
    </TransactionSendContextProvider>
  );
};

export default TransactionStack;
export type { SendRoutesParams };
