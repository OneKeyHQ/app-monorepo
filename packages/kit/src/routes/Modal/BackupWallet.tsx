import { useIsVerticalLayout } from '@onekeyhq/components';
import BackupAttentions from '@onekeyhq/kit/src/views/BackupWallet/BackupAttentions';
import BackupLite from '@onekeyhq/kit/src/views/BackupWallet/BackupLite';
import BackupManual from '@onekeyhq/kit/src/views/BackupWallet/BackupManual';
import BackupMnemonic from '@onekeyhq/kit/src/views/BackupWallet/BackupMnemonic';
import BackupOptions from '@onekeyhq/kit/src/views/BackupWallet/BackupOptions';

import { buildModalStackNavigatorOptions } from './buildModalStackNavigatorOptions';
import createStackNavigator from './createStackNavigator';

export enum BackupWalletModalRoutes {
  BackupWalletOptionsModal = 'BackupWalletOptionsModal',
  BackupWalletManualModal = 'BackupWalletManualModal',
  BackupWalletLiteModal = 'BackupWalletLiteModal',
  BackupWalletAttentionsModal = 'BackupWalletAttentionsModal',
  BackupWalletMnemonicModal = 'BackupWalletMnemonicModal',
}

export type BackupWalletRoutesParams = {
  [BackupWalletModalRoutes.BackupWalletManualModal]: {
    walletId: string;
  };
  [BackupWalletModalRoutes.BackupWalletOptionsModal]: {
    walletId: string;
  };
  [BackupWalletModalRoutes.BackupWalletLiteModal]: {
    walletId: string;
  };
  [BackupWalletModalRoutes.BackupWalletAttentionsModal]: {
    walletId: string;
    password: string;
  };
  [BackupWalletModalRoutes.BackupWalletMnemonicModal]: {
    mnemonic: string;
    walletId: string;
  };
};

const BackupWalletNavigator = createStackNavigator<BackupWalletRoutesParams>();

const modalRoutes = [
  {
    name: BackupWalletModalRoutes.BackupWalletManualModal,
    component: BackupManual,
  },
  {
    name: BackupWalletModalRoutes.BackupWalletAttentionsModal,
    component: BackupAttentions,
  },
  {
    name: BackupWalletModalRoutes.BackupWalletMnemonicModal,
    component: BackupMnemonic,
  },
  {
    name: BackupWalletModalRoutes.BackupWalletOptionsModal,
    component: BackupOptions,
  },
  {
    name: BackupWalletModalRoutes.BackupWalletLiteModal,
    component: BackupLite,
  },
];

const BackupWalletModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <BackupWalletNavigator.Navigator
      screenOptions={(navInfo) => ({
        headerShown: false,
        ...buildModalStackNavigatorOptions({ isVerticalLayout, navInfo }),
      })}
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
