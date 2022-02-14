import React from 'react';

import { createStackNavigator } from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';
import CreateWallet from '@onekeyhq/kit/src/views/CreateWallet';

export enum CreateWalletModalRoutes {
  CreateWalletModal = 'CreateWalletModal',
}

export type CreateWalletRoutesParams = {
  [CreateWalletModalRoutes.CreateWalletModal]: undefined;
};

const CreateWalletNavigator = createStackNavigator<CreateWalletRoutesParams>();

const modalRoutes = [
  {
    name: CreateWalletModalRoutes.CreateWalletModal,
    component: CreateWallet,
  },
];

const CreateWalletModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <CreateWalletNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <CreateWalletNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </CreateWalletNavigator.Navigator>
  );
};

export default CreateWalletModalStack;
