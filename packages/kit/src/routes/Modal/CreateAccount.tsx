import React from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';
import type {
  Account,
  ImportableHDAccount,
} from '@onekeyhq/engine/src/types/account';
import AddNewAccountModal from '@onekeyhq/kit/src/views/Account/AddNewAccount';
import CreateAccountAuthenticationModal from '@onekeyhq/kit/src/views/Account/AddNewAccount/Authentication';
import RecoverAccounts from '@onekeyhq/kit/src/views/Account/AddNewAccount/RecoverAccounts';
import RecoverAccountsAdvanced from '@onekeyhq/kit/src/views/Account/AddNewAccount/RecoverAccountsAdvanced';
import RecoverConfirm from '@onekeyhq/kit/src/views/Account/AddNewAccount/RecoverConfirm';
import SelectChain from '@onekeyhq/kit/src/views/Account/AddNewAccount/SelectChain';

import { CreateAccountModalRoutes } from '../routesEnum';

import { buildModalStackNavigatorOptions } from './buildModalStackNavigatorOptions';
import createStackNavigator from './createStackNavigator';

export { CreateAccountModalRoutes };

type RecoverAccountsAdvancedParams = {
  fromIndex: number;
  generateCount?: number;
  showPathAndLink: boolean;
};

export type CreateAccountRoutesParams = {
  [CreateAccountModalRoutes.CreateAccountForm]: {
    walletId: string;
    selectedNetworkId?: string;
  };
  [CreateAccountModalRoutes.CreateAccountAuthentication]: {
    onDone: (password: string) => void;
    walletId: string;
  };
  [CreateAccountModalRoutes.RecoverySelectChainList]: {
    walletId: string;
  };
  [CreateAccountModalRoutes.RecoverAccountsList]: {
    walletId: string;
    network: string;
    password: string;
    purpose: number;
  };
  [CreateAccountModalRoutes.RecoverAccountsAdvanced]: RecoverAccountsAdvancedParams & {
    onApply: (options: RecoverAccountsAdvancedParams) => void;
  };
  [CreateAccountModalRoutes.RecoverAccountsConfirm]: {
    accounts: (ImportableHDAccount & {
      selected: boolean;
      isDisabled: boolean;
    })[];
    walletId: string;
    network: string;
    purpose: number;
    existingAccounts: Account[];
    config: RecoverAccountsAdvancedParams;
    selectedAll: boolean;
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
    name: CreateAccountModalRoutes.RecoverAccountsAdvanced,
    component: RecoverAccountsAdvanced,
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
      screenOptions={(navInfo) => ({
        ...buildModalStackNavigatorOptions({ isVerticalLayout, navInfo }),
      })}
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
