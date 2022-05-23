import React from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';
import { EVMDecodedItem } from '@onekeyhq/engine/src/vaults/impl/evm/decoder/decoder';
import HistoryDetail from '@onekeyhq/kit/src/views/TransactionDetails/HistoryDetail';

import createStackNavigator from './createStackNavigator';

export enum TransactionDetailModalRoutes {
  HistoryDetailModal = 'HistoryDetailModal',
}

export type TransactionDetailRoutesParams = {
  [TransactionDetailModalRoutes.HistoryDetailModal]: {
    decodedItem: EVMDecodedItem;
  };
};

const TransactionDetailNavigator =
  createStackNavigator<TransactionDetailRoutesParams>();

const modalRoutes = [
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
