import React from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';
import ContractCall from '@onekeyhq/kit/src/views/DappModals/ContractCall';
import ContractData from '@onekeyhq/kit/src/views/DappModals/ContractData';
import TransactionEditFee from '@onekeyhq/kit/src/views/Send/SendEditFee';

import createStackNavigator from './createStackNavigator';

export enum DappContractCallModalRoutes {
  ContractCallModal = 'ContractCallModal',
  EditFeeModal = 'EditFeeModal',
  ContractDataModal = 'ContractDataModal',
}

export type DappMulticallRoutesParams = {
  [DappContractCallModalRoutes.ContractCallModal]: undefined;
  [DappContractCallModalRoutes.EditFeeModal]: undefined;
  [DappContractCallModalRoutes.ContractDataModal]: { contractData: string };
};

const DappContractCallModalNavigator =
  createStackNavigator<DappMulticallRoutesParams>();

const modalRoutes = [
  {
    name: DappContractCallModalRoutes.ContractCallModal,
    component: ContractCall,
  },
  {
    name: DappContractCallModalRoutes.EditFeeModal,
    component: TransactionEditFee,
  },
  {
    name: DappContractCallModalRoutes.ContractDataModal,
    component: ContractData,
  },
];

const DappContractCallStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <DappContractCallModalNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <DappContractCallModalNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </DappContractCallModalNavigator.Navigator>
  );
};

export default DappContractCallStack;
