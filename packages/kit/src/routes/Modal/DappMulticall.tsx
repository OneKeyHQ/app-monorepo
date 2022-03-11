import React from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';
import ContractData from '@onekeyhq/kit/src/views/DappModals/ContractData';
import Multicall from '@onekeyhq/kit/src/views/DappModals/Multicall';
import TransactionEditFee from '@onekeyhq/kit/src/views/Send/SendEditFee';

import createStackNavigator from './createStackNavigator';

export enum DappMulticallModalRoutes {
  MulticallModal = 'MulticallModal',
  EditFeeModal = 'EditFeeModal',
  ContractDataModal = 'ContractDataModal',
}

export type DappMulticallRoutesParams = {
  [DappMulticallModalRoutes.MulticallModal]: undefined;
  [DappMulticallModalRoutes.EditFeeModal]: undefined;
  [DappMulticallModalRoutes.ContractDataModal]: { contractData: string };
};

const DappMulticallModalNavigator =
  createStackNavigator<DappMulticallRoutesParams>();

const modalRoutes = [
  {
    name: DappMulticallModalRoutes.MulticallModal,
    component: Multicall,
  },
  {
    name: DappMulticallModalRoutes.EditFeeModal,
    component: TransactionEditFee,
  },
  {
    name: DappMulticallModalRoutes.ContractDataModal,
    component: ContractData,
  },
];

const DappMulticallStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <DappMulticallModalNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <DappMulticallModalNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </DappMulticallModalNavigator.Navigator>
  );
};

export default DappMulticallStack;
