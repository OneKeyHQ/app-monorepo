import React from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';
import { EVMDecodedItem } from '@onekeyhq/engine/src/vaults/impl/evm/decoder/decoder';
import { IDecodedTx, IHistoryTx } from '@onekeyhq/engine/src/vaults/types';

import { TxHistoryDetailModal } from '../../views/TxHistory/TxHistoryDetailModal';

import createStackNavigator from './createStackNavigator';

export enum TransactionDetailModalRoutes {
  HistoryDetailModal = 'HistoryDetailModal',
}

export type TransactionDetailRoutesParams = {
  [TransactionDetailModalRoutes.HistoryDetailModal]: {
    decodedItem?: EVMDecodedItem;
    decodedTx?: IDecodedTx;
    historyTx?: IHistoryTx;
  };
};

const TransactionDetailNavigator =
  createStackNavigator<TransactionDetailRoutesParams>();

const modalRoutes = [
  {
    name: TransactionDetailModalRoutes.HistoryDetailModal,
    // component: HistoryDetail,
    component: TxHistoryDetailModal,
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
