import React from 'react';

import { createStackNavigator } from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';
import ManagerWalletDialogAuthorityVerifyView from '@onekeyhq/kit/src/views/ManagerWallet/ManagerWalletDialogAuthorityVerify';
import { ManagerType } from '@onekeyhq/kit/src/views/ManagerWallet/types';

export enum ManagerWalletModalRoutes {
  ManagerWalletModal = 'ManagerWalletModal',
  ManagerWalletDialogAuthorityVerifyModal = 'ManagerWalletDialogAuthorityVerifyModal',
}

export type ManagerWalletRoutesParams = {
  [ManagerWalletModalRoutes.ManagerWalletModal]: {
    walletId: string;
  };
  [ManagerWalletModalRoutes.ManagerWalletDialogAuthorityVerifyModal]: {
    walletId: string;
    managerType: ManagerType;
  };
};

const ManagerWalletNavigator =
  createStackNavigator<ManagerWalletRoutesParams>();

const modalRoutes = [
  {
    name: ManagerWalletModalRoutes.ManagerWalletDialogAuthorityVerifyModal,
    component: ManagerWalletDialogAuthorityVerifyView,
  },
];

const ManagerWalletModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <ManagerWalletNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <ManagerWalletNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </ManagerWalletNavigator.Navigator>
  );
};

export { ManagerWalletModalStack };
