import React from 'react';

import { createStackNavigator } from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';
import Transaction from '@onekeyhq/kit/src/views/Transaction/transaction';
import TransactionConfirm from '@onekeyhq/kit/src/views/Transaction/transactionConfirm';
import TransactionEditFee from '@onekeyhq/kit/src/views/Transaction/transactionEditFee';

export enum TransactionModalRoutes {
  TransactionModal = 'Transaction',
  TransactionConfirmModal = 'TransactionConfirmModal',
  TransactionEditFeeModal = 'TransactionEditFeeModal',
}

export type TransactionModalRoutesParams = {
  [key in TransactionModalRoutes]: undefined;
};

const TransactionModalNavigator =
  createStackNavigator<TransactionModalRoutesParams>();

const modalRoutes = [
  {
    name: TransactionModalRoutes.TransactionModal,
    component: Transaction,
  },
  {
    name: TransactionModalRoutes.TransactionConfirmModal,
    component: TransactionConfirm,
  },
  {
    name: TransactionModalRoutes.TransactionEditFeeModal,
    component: TransactionEditFee,
  },
];

const TransactionStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <TransactionModalNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <TransactionModalNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </TransactionModalNavigator.Navigator>
  );
};

export default TransactionStack;
