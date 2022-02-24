import React from 'react';

import { createStackNavigator } from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';
import BackupMnemonicsModal from '@onekeyhq/kit/src/views/BackupWallet/BackupMnemonics';
import BackupSeedHintModal from '@onekeyhq/kit/src/views/BackupWallet/BackupSeedHint';
import {
  BackupWalletModalRoutes,
  BackupWalletRoutesParams,
} from '@onekeyhq/kit/src/views/BackupWallet/types';

const BackupWalletNavigator = createStackNavigator<BackupWalletRoutesParams>();

const modalRoutes = [
  {
    name: BackupWalletModalRoutes.BackupSeedHintModal,
    component: BackupSeedHintModal,
  },
  {
    name: BackupWalletModalRoutes.BackupMnemonicsModal,
    component: BackupMnemonicsModal,
  },
];

const BackupWalletModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <BackupWalletNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <BackupWalletNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </BackupWalletNavigator.Navigator>
  );
};

export default BackupWalletModalStack;
export { BackupWalletModalRoutes };
export type { BackupWalletRoutesParams };
