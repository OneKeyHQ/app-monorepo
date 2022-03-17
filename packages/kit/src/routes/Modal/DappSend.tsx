import React from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';
import SendConfirm from '@onekeyhq/kit/src/views/DappModals/SendConfirm';
import SendConfirmAuth from '@onekeyhq/kit/src/views/DappModals/SendConfirmAuth';
import TransactionEditFee from '@onekeyhq/kit/src/views/Send/SendEditFee';

import createStackNavigator from './createStackNavigator';

export enum DappSendModalRoutes {
  SendConfirmModal = 'SendConfirmModal',
  SendConfirmAuthModal = 'SendConfirmAuthModal',
  EditFeeModal = 'EditFeeModal',
}

export type DappSendRoutesParams = {
  [DappSendModalRoutes.SendConfirmModal]: undefined;
  [DappSendModalRoutes.EditFeeModal]: undefined;
  [DappSendModalRoutes.SendConfirmAuthModal]: {
    // For resolved dapp id
    id: string | number;
    to: string;
    account: {
      id: string;
      name: string;
      address: string;
    };
    network: {
      id: string;
      name: string;
    };
    value: string;
    token: {
      idOnNetwork?: string;
      logoURI?: string;
      name?: string;
      symbol?: string;
    };
    gasPrice: string;
    gasLimit: string;
  };
};

const DappSendModalNavigator = createStackNavigator<DappSendRoutesParams>();

const modalRoutes = [
  {
    name: DappSendModalRoutes.SendConfirmModal,
    component: SendConfirm,
  },
  {
    name: DappSendModalRoutes.EditFeeModal,
    component: TransactionEditFee,
  },
  {
    name: DappSendModalRoutes.SendConfirmAuthModal,
    component: SendConfirmAuth,
  },
];

const DappSendStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <DappSendModalNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <DappSendModalNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </DappSendModalNavigator.Navigator>
  );
};

export default DappSendStack;
