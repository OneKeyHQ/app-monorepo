import { useIsVerticalLayout } from '@onekeyhq/components';
import type { IWallet } from '@onekeyhq/engine/src/types';
import BackupAttentions from '@onekeyhq/kit/src/views/BackupWallet/BackupAttentions';
import BackupLite from '@onekeyhq/kit/src/views/BackupWallet/BackupLite';
import BackupManual from '@onekeyhq/kit/src/views/BackupWallet/BackupManual';
import BackupMnemonic from '@onekeyhq/kit/src/views/BackupWallet/BackupMnemonic';
import BackupOptions from '@onekeyhq/kit/src/views/BackupWallet/BackupOptions';
import ShowDotMap from '@onekeyhq/kit/src/views/KeyTag/Screen/ShowDotMap';

import { KeyTagRoutes } from '../../views/KeyTag/Routes/enums';
import KeyTagBackupWalletAttentions from '../../views/KeyTag/Screen/KeyTagAttentions';
import VerifyPassword from '../../views/KeyTag/Screen/VerifyPassword';

import { buildModalStackNavigatorOptions } from './buildModalStackNavigatorOptions';
import createStackNavigator from './createStackNavigator';

import type {
  IKeytagRoutesParams,
  IkeyTagShowDotMapParams,
} from '../../views/KeyTag/Routes/types';

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
  [KeyTagRoutes.KeyTagVerifyPassword]: {
    walletId: string;
    wallet?: IWallet;
  };
  [KeyTagRoutes.KeyTagAttention]: {
    walletId: string;
    password: string;
    wallet?: IWallet;
  };
  [KeyTagRoutes.ShowDotMap]: IkeyTagShowDotMapParams;
};

const BackupWalletNavigator = createStackNavigator<
  BackupWalletRoutesParams & IKeytagRoutesParams
>();

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
  { name: KeyTagRoutes.KeyTagVerifyPassword, component: VerifyPassword },
  {
    name: KeyTagRoutes.KeyTagAttention,
    component: KeyTagBackupWalletAttentions,
  },
  {
    name: KeyTagRoutes.ShowDotMap,
    component: ShowDotMap,
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
