import React from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';
import type { ImportableHDAccount } from '@onekeyhq/engine/src/types/account';
import AddNewAccountModal from '@onekeyhq/kit/src/views/Account/AddNewAccount';
import CreateAccountAuthenticationModal from '@onekeyhq/kit/src/views/Account/AddNewAccount/Authentication';
import RecoverAccounts from '@onekeyhq/kit/src/views/Account/AddNewAccount/RecoverAccounts';
import RecoverConfirm from '@onekeyhq/kit/src/views/Account/AddNewAccount/RecoverConfirm';
import SelectChain from '@onekeyhq/kit/src/views/Account/AddNewAccount/SelectChain';

import createStackNavigator from './createStackNavigator';

export enum CreateAccountModalRoutes {
  CreateAccountForm = 'CreateAccountForm',
  CreateAccountAuthentication = 'CreateAccountAuthentication',
  RecoverySelectChainList = 'RecoverySelectChainList',
  RecoverAccountsList = 'RecoverAccountList',
  RecoverAccountsConfirm = 'RecoverAccountsConfirm',
  RecoverAccountsConfirmAuthentication = 'RecoverAccountsConfirmAuthentication',
}

type OnLoadingAccountType = (
  walletId: string,
  networkId: string,
  ready?: boolean,
) => void;

export type CreateAccountRoutesParams = {
  [CreateAccountModalRoutes.CreateAccountForm]: {
    walletId: string;
    selectedNetworkId?: string;
    onLoadingAccount?: OnLoadingAccountType;
  };
  [CreateAccountModalRoutes.CreateAccountAuthentication]: {
    onDone: (password: string) => void;
    walletId: string;
  };
  [CreateAccountModalRoutes.RecoverySelectChainList]: {
    onLoadingAccount?: OnLoadingAccountType;
    walletId: string;
  };
  [CreateAccountModalRoutes.RecoverAccountsList]: {
    onLoadingAccount?: OnLoadingAccountType;
    walletId: string;
    network: string;
    password: string;
    purpose: number;
  };
  [CreateAccountModalRoutes.RecoverAccountsConfirm]: {
    onLoadingAccount?: OnLoadingAccountType;
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
  {
    name: CreateAccountModalRoutes.RecoverySelectChainList,
    component: SelectChain,
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
