import React from 'react';

import { createStackNavigator } from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';
import { BackupWalletView } from '@onekeyhq/kit/src/views/BackupWallet';
import BackupAuthorityWalletVerifyView from '@onekeyhq/kit/src/views/BackupWallet/BackupAuthorityVerify/index';
import BackupWalletManualHintView from '@onekeyhq/kit/src/views/BackupWallet/BackupManualHint/index';
import BackupWalletManualSuccessView from '@onekeyhq/kit/src/views/BackupWallet/BackupManualSuccess/index';
import BackupMnemonicsVerifyView from '@onekeyhq/kit/src/views/BackupWallet/BackupMnemonicsVerify/index';
import BackupShowMnemonicsView from '@onekeyhq/kit/src/views/BackupWallet/BackupShowMnemonics';
import BackupWalletWarningView from '@onekeyhq/kit/src/views/BackupWallet/BackupWarning/index';
import { BackupType } from '@onekeyhq/kit/src/views/BackupWallet/types';

export enum BackupWalletModalRoutes {
  BackupWalletModal = 'BackupWalletModal',
  BackupWalletAuthorityVerifyModal = 'BackupWalletAuthorityVerifyModal',
  BackupWalletManualHintModal = 'BackupWalletManualHintModal',
  BackupWalletWarningModal = 'BackupWalletWarningModal',
  BackupShowMnemonicsModal = 'BackupShowMnemonicsModal',
  BackupWalletMnemonicsVerifyModal = 'BackupWalletMnemonicsVerifyModal',
  BackupWalletManualSuccessModal = 'BackupWalletManualSuccessModal',
}

export type BackupWalletRoutesParams = {
  [BackupWalletModalRoutes.BackupWalletModal]: {
    walletId: string;
  };
  [BackupWalletModalRoutes.BackupWalletAuthorityVerifyModal]: {
    walletId: string;
    backupType: BackupType;
  };
  [BackupWalletModalRoutes.BackupWalletManualHintModal]: {
    backup: string;
    walletId: string;
  };
  [BackupWalletModalRoutes.BackupWalletWarningModal]: {
    backup: string;
    walletId: string;
  };
  [BackupWalletModalRoutes.BackupShowMnemonicsModal]: {
    backup: string;
    readOnly: boolean;
    walletId: string;
  };
  [BackupWalletModalRoutes.BackupWalletMnemonicsVerifyModal]: {
    mnemonics: string[];
    walletId: string;
  };
  [BackupWalletModalRoutes.BackupWalletManualSuccessModal]: {
    walletId: string | null;
  };
};

const BackupWalletNavigator = createStackNavigator<BackupWalletRoutesParams>();

const modalRoutes = [
  {
    name: BackupWalletModalRoutes.BackupWalletModal,
    component: BackupWalletView,
  },
  {
    name: BackupWalletModalRoutes.BackupWalletAuthorityVerifyModal,
    component: BackupAuthorityWalletVerifyView,
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

const viewMnemonicsModalRoutes = [
  {
    name: BackupWalletModalRoutes.BackupWalletAuthorityVerifyModal,
    component: BackupAuthorityWalletVerifyView,
  },
  {
    name: BackupWalletModalRoutes.BackupShowMnemonicsModal,
    component: BackupShowMnemonicsView,
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

const BackupWalletViewMnemonicsModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <BackupWalletNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {viewMnemonicsModalRoutes.map((route) => (
        <BackupWalletNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </BackupWalletNavigator.Navigator>
  );
};

export { BackupWalletModalStack, BackupWalletViewMnemonicsModalStack };
