import React from 'react';

import { createStackNavigator } from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';
import AddNewAccountModal from '@onekeyhq/kit/src/views/Account/AddNewAccount';
import RecoveryAccountModal from '@onekeyhq/kit/src/views/Account/ImportedAccount';

export enum CreateAccountModalRoutes {
  CreateAccountForm = 'CreateAccountForm',
  RecoveryAccountForm = 'RecoveryAccountForm',
}

export type CreateAccountRoutesParams = {
  [CreateAccountModalRoutes.CreateAccountForm]: { walletId: string };
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
