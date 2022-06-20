import React from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';
import type { ImportableHDAccount } from '@onekeyhq/engine/src/types/account';
import AddNewAccountModal from '@onekeyhq/kit/src/views/Account/AddNewAccount';
import CreateAccountAuthenticationModal from '@onekeyhq/kit/src/views/Account/AddNewAccount/Authentication';
import RecoverAccounts from '@onekeyhq/kit/src/views/Account/AddNewAccount/RecoverAccounts';
import RecoverConfirm from '@onekeyhq/kit/src/views/Account/AddNewAccount/RecoverConfirm';
import RecoveryAccountModal from '@onekeyhq/kit/src/views/Account/ImportedAccount';

import createStackNavigator from './createStackNavigator';

export enum CreateAccountModalRoutes {
  CreateAccountForm = 'CreateAccountForm',
  CreateAccountAuthentication = 'CreateAccountAuthentication',
  RecoveryAccountForm = 'RecoveryAccountForm',
  RecoverAccountsList = 'RecoverAccountList',
  RecoverAccountsConfirm = 'RecoverAccountsConfirm',
  RecoverAccountsConfirmAuthentication = 'RecoverAccountsConfirmAuthentication',
}

export type CreateAccountRoutesParams = {
  [CreateAccountModalRoutes.CreateAccountForm]: {
    walletId: string;
    onLoadingAccount?: (networkId?: string) => void;
    selectedNetworkId?: string;
  };
  [CreateAccountModalRoutes.CreateAccountAuthentication]: {
    onDone: (password: string) => void;
    walletId: string;
  };
  [CreateAccountModalRoutes.RecoveryAccountForm]: undefined;
  [CreateAccountModalRoutes.RecoverAccountsList]: {
    walletId: string;
    network: string;
    password: string;
    purpose: number;
  };
  [CreateAccountModalRoutes.RecoverAccountsConfirm]: {
    accounts: (ImportableHDAccount & {
      selected: boolean;
      isDisabled: boolean;
    })[];
    walletId: string;
    network: string;
    purpose: number;
  };
  [CreateAccountModalRoutes.RecoverAccountsConfirmAuthentication]: {
    walletId: string;
    onDone: (password: string) => void;
  };
};

const CreateAccountNavigator =
  createStackNavigator<CreateAccountRoutesParams>();

const modalRoutes = [
  {
    name: CreateAccountModalRoutes.CreateAccountForm,
    component: AddNewAccountModal,
  },
  {
    name: CreateAccountModalRoutes.CreateAccountAuthentication,
    component: CreateAccountAuthenticationModal,
  },
  {
    name: CreateAccountModalRoutes.RecoveryAccountForm,
    component: RecoveryAccountModal,
  },
  {
    name: CreateAccountModalRoutes.RecoverAccountsList,
    component: RecoverAccounts,
  },
  {
    name: CreateAccountModalRoutes.RecoverAccountsConfirm,
    component: RecoverConfirm,
  },
  {
    name: CreateAccountModalRoutes.RecoverAccountsConfirmAuthentication,
    component: CreateAccountAuthenticationModal,
  },
];

const CreateAccountModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <CreateAccountNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <CreateAccountNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </CreateAccountNavigator.Navigator>
  );
};

export default CreateAccountModalStack;
