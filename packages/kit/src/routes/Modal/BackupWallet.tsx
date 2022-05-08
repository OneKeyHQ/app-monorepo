import React from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';
import BackupWallet from '@onekeyhq/kit/src/views/BackupWallet';
import Attentions from '@onekeyhq/kit/src/views/BackupWallet/Attentions';
import BackupAuthorityWalletVerifyView from '@onekeyhq/kit/src/views/BackupWallet/BackupAuthorityVerify/index';
import BackupWalletManualHintView from '@onekeyhq/kit/src/views/BackupWallet/BackupManualHint/index';
import BackupWalletManualSuccessView from '@onekeyhq/kit/src/views/BackupWallet/BackupManualSuccess/index';
import BackupMnemonicsVerifyView from '@onekeyhq/kit/src/views/BackupWallet/BackupMnemonicsVerify/index';
import BackupShowMnemonicsView from '@onekeyhq/kit/src/views/BackupWallet/BackupShowMnemonics';
import BackupWalletWarningView from '@onekeyhq/kit/src/views/BackupWallet/BackupWarning/index';
import Mnemonic from '@onekeyhq/kit/src/views/BackupWallet/Mnemonic';
import { BackupType } from '@onekeyhq/kit/src/views/BackupWallet/types';

import createStackNavigator from './createStackNavigator';

export enum BackupWalletModalRoutes {
  BackupWalletModal = 'BackupWalletModal',
  BackupWalletAuthorityVerifyModal = 'BackupWalletAuthorityVerifyModal',
  BackupWalletManualHintModal = 'BackupWalletManualHintModal',
  BackupWalletWarningModal = 'BackupWalletWarningModal',
  BackupShowMnemonicsModal = 'BackupShowMnemonicsModal',
  BackupWalletMnemonicsVerifyModal = 'BackupWalletMnemonicsVerifyModal',
  BackupWalletManualSuccessModal = 'BackupWalletManualSuccessModal',
  BackupWalletAttentionsModal = 'BackupWalletAttentionsModal',
  BackupWalletMnemonicModal = 'BackupWalletMnemonicModal',
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
  [BackupWalletModalRoutes.BackupWalletAttentionsModal]: {
    walletId: string;
    password: string;
  };
  [BackupWalletModalRoutes.BackupWalletMnemonicModal]: {
    mnemonic: string;
  };
};

const BackupWalletNavigator = createStackNavigator<BackupWalletRoutesParams>();

const modalRoutes = [
  {
    name: BackupWalletModalRoutes.BackupWalletModal,
    component: BackupWallet,
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
  {
    name: BackupWalletModalRoutes.BackupWalletAttentionsModal,
    component: Attentions,
  },
  {
    name: BackupWalletModalRoutes.BackupWalletMnemonicModal,
    component: Mnemonic,
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
