import React from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';
import { Transaction } from '@onekeyhq/engine/src/types/covalent';
import TransactionDetails from '@onekeyhq/kit/src/views/TransactionDetails';

import createStackNavigator from './createStackNavigator';

export enum TransactionDetailModalRoutes {
  TransactionDetailModal = 'TransactionDetailModal',
}

export type TransactionDetailRoutesParams = {
  [TransactionDetailModalRoutes.TransactionDetailModal]: {
    txHash: string | null;
    tx: Transaction | null;
  };
};

const TransactionDetailNavigator =
  createStackNavigator<TransactionDetailRoutesParams>();

const modalRoutes = [
  {
    name: TransactionDetailModalRoutes.TransactionDetailModal,
    component: TransactionDetails,
  },
];

const TransactionDetailModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <TransactionDetailNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <TransactionDetailNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </TransactionDetailNavigator.Navigator>
  );
};

export default TransactionDetailModalStack;
