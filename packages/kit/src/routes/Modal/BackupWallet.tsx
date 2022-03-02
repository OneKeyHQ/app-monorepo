import React from 'react';

import { createStackNavigator } from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';
import { BackupWalletView as BackupWalletModal } from '@onekeyhq/kit/src/views/BackupWallet';
import BackupShowMnemonicsView from '@onekeyhq/kit/src/views/BackupWallet/BackupShowMnemonics';
import {
  BackupWalletModalRoutes,
  BackupWalletRoutesParams,
} from '@onekeyhq/kit/src/views/BackupWallet/routes';

import { BackupAuthorityWalletVerify } from '../../views/BackupWallet/BackupAuthorityVerify';
import BackupWalletManualHintView from '../../views/BackupWallet/BackupManualHint/index';
import BackupWalletManualSuccessView from '../../views/BackupWallet/BackupManualSuccess/index';
import BackupMnemonicsVerifyView from '../../views/BackupWallet/BackupMnemonicsVerify/index';
import BackupWalletWarningView from '../../views/BackupWallet/BackupWarning/index';

const BackupWalletNavigator = createStackNavigator<BackupWalletRoutesParams>();

const modalRoutes = [
  {
    name: BackupWalletModalRoutes.BackupWalletModal,
    component: BackupWalletModal,
  },
  {
    name: BackupWalletModalRoutes.BackupWalletAuthorityVerifyModal,
    component: BackupAuthorityWalletVerify,
  },
  {
    name: BackupWalletModalRoutes.BackupWalletManualHintModal,
    component: BackupWalletManualHintView,
  },
  {
    name: BackupWalletModalRoutes.BackupWalletWarningModal,
    component: BackupWalletWarningView,
  },
  {
    name: BackupWalletModalRoutes.BackupShowMnemonicsModal,
    component: BackupShowMnemonicsView,
  },
  {
    name: BackupWalletModalRoutes.BackupWalletMnemonicsVerifyModal,
    component: BackupMnemonicsVerifyView,
  },
  {
    name: BackupWalletModalRoutes.BackupWalletManualSuccessModal,
    component: BackupWalletManualSuccessView,
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
