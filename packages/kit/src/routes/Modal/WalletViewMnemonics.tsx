import React from 'react';

import { createStackNavigator } from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';
import BackupShowMnemonicsView from '@onekeyhq/kit/src/views/BackupWallet/BackupShowMnemonics';
import {
  BackupWalletModalRoutes,
  BackupWalletRoutesParams,
} from '@onekeyhq/kit/src/views/BackupWallet/routes';

import { BackupAuthorityWalletVerify } from '../../views/BackupWallet/BackupAuthorityVerify';

const BackupWalletNavigator = createStackNavigator<BackupWalletRoutesParams>();

const modalRoutes = [
  {
    name: BackupWalletModalRoutes.BackupWalletAuthorityVerifyModal,
    component: BackupAuthorityWalletVerify,
  },
  {
    name: BackupWalletModalRoutes.BackupShowMnemonicsModal,
    component: BackupShowMnemonicsView,
  },
];

const WalletViewMnemonicsModalStack = () => {
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

export default WalletViewMnemonicsModalStack;
export { BackupWalletModalRoutes };
export type { BackupWalletRoutesParams };
