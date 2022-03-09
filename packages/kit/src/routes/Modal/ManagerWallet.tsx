import React from 'react';

import { createStackNavigator } from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';
import ManagerWalletLocalValidationView from '@onekeyhq/kit/src/views/ManagerWallet/LocalValidationModal';
import ManagerWalletDialogAuthorityVerifyView from '@onekeyhq/kit/src/views/ManagerWallet/ManagerWalletDialogAuthorityVerify';
import ModifyWalletNameView from '@onekeyhq/kit/src/views/ManagerWallet/ModifyWallet/name';
import { ManagerType } from '@onekeyhq/kit/src/views/ManagerWallet/types';

export enum ManagerWalletModalRoutes {
  ManagerWalletModal = 'ManagerWalletModal',
  ManagerWalletDialogAuthorityVerifyModal = 'ManagerWalletDialogAuthorityVerifyModal',
  ManagerWalletAuthorityVerifyModal = 'ManagerWalletAuthorityVerifyModal',
  ManagerWalletModifyNameModal = 'ManagerWalletModifyNameModal',
}

export type ManagerWalletRoutesParams = {
  [ManagerWalletModalRoutes.ManagerWalletModal]: {
    walletId: string;
  };
  [ManagerWalletModalRoutes.ManagerWalletDialogAuthorityVerifyModal]: {
    walletId: string;
    managerType: ManagerType;
  };
  [ManagerWalletModalRoutes.ManagerWalletModifyNameModal]: {
    walletId: string;
  };
  [ManagerWalletModalRoutes.ManagerWalletAuthorityVerifyModal]: {
    requestId: string;
    onSuccess: (requestId: string, password: string) => void;
    onCancel: () => void;
  };
};

const ManagerWalletNavigator =
  createStackNavigator<ManagerWalletRoutesParams>();

const modalRoutes = [
  {
    name: ManagerWalletModalRoutes.ManagerWalletDialogAuthorityVerifyModal,
    component: ManagerWalletDialogAuthorityVerifyView,
  },
  {
    name: ManagerWalletModalRoutes.ManagerWalletModifyNameModal,
    component: ModifyWalletNameView,
  },
  {
    name: ManagerWalletModalRoutes.ManagerWalletAuthorityVerifyModal,
    component: ManagerWalletLocalValidationView,
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
