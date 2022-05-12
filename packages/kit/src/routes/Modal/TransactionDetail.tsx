import React from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';
import { Transaction } from '@onekeyhq/engine/src/types/covalent';
import { EVMDecodedItem } from '@onekeyhq/engine/src/vaults/impl/evm/decoder/decoder';
import TransactionDetails from '@onekeyhq/kit/src/views/TransactionDetails';
import HistoryDetail from '@onekeyhq/kit/src/views/TransactionDetails/HistoryDetail';

import createStackNavigator from './createStackNavigator';

export enum TransactionDetailModalRoutes {
  TransactionDetailModal = 'TransactionDetailModal',
  HistoryDetailModal = 'HistoryDetailModal',
}

export type TransactionDetailRoutesParams = {
  [TransactionDetailModalRoutes.TransactionDetailModal]: {
    txHash: string | null;
    tx: Transaction | null;
  };
  [TransactionDetailModalRoutes.HistoryDetailModal]: {
    decodedItem: EVMDecodedItem;
  };
};

const TransactionDetailNavigator =
  createStackNavigator<TransactionDetailRoutesParams>();

const modalRoutes = [
  {
    name: TransactionDetailModalRoutes.TransactionDetailModal,
    component: TransactionDetails,
  },
  {
    name: TransactionDetailModalRoutes.HistoryDetailModal,
    component: HistoryDetail,
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
