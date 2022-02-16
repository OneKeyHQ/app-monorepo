import React from 'react';

import { createStackNavigator } from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';
import SendConfirm from '@onekeyhq/kit/src/views/DappModals/SendConfirm';
import TransactionEditFee from '@onekeyhq/kit/src/views/Send/SendEditFee';

export enum DappSendModalRoutes {
  SendConfirmModal = 'SendConfirmModal',
  EditFeeModal = 'EditFeeModal',
}

export type DappSendRoutesParams = {
  [DappSendModalRoutes.SendConfirmModal]: undefined;
  [DappSendModalRoutes.EditFeeModal]: undefined;
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
