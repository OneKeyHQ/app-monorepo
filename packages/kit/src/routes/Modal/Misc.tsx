import React from 'react';

import { createStackNavigator } from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';
import Terms from '@onekeyhq/kit/src/views/Terms';

import CreateWhatWallet from '../../views/CreateWhatWallet';

export enum MiscModalRoutes {
  TermsModal = 'TermsModal',
  CreateWhatWalletModal = 'CreateWhatWalletModal',
}

export type MiscRoutesParams = {
  [MiscModalRoutes.TermsModal]: undefined;
  [MiscModalRoutes.CreateWhatWalletModal]: undefined;
};

const MiscNavigator = createStackNavigator<MiscRoutesParams>();

const modalRoutes = [
  {
    name: MiscModalRoutes.TermsModal,
    component: Terms,
  },
  {
    name: MiscModalRoutes.CreateWhatWalletModal,
    component: CreateWhatWallet,
  },
];

const MiscModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <MiscNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <MiscNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </MiscNavigator.Navigator>
  );
};

export default MiscModalStack;
