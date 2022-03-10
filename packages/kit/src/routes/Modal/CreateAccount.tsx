import React from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';
import AddNewAccountModal from '@onekeyhq/kit/src/views/Account/AddNewAccount';
import CreateAccountAuthenticationModal from '@onekeyhq/kit/src/views/Account/AddNewAccount/Authentication';
import RecoveryAccountModal from '@onekeyhq/kit/src/views/Account/ImportedAccount';

import createStackNavigator from './createStackNavigator';

export enum CreateAccountModalRoutes {
  CreateAccountForm = 'CreateAccountForm',
  CreateAccountAuthentication = 'CreateAccountAuthentication',
  RecoveryAccountForm = 'RecoveryAccountForm',
}

export type CreateAccountRoutesParams = {
  [CreateAccountModalRoutes.CreateAccountForm]: { walletId: string };
  [CreateAccountModalRoutes.CreateAccountAuthentication]: {
    walletId: string;
    name: string;
    network: string;
  };
  [CreateAccountModalRoutes.RecoveryAccountForm]: undefined;
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
