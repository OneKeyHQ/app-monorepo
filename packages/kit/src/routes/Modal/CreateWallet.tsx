import React from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';
import ImportedAccount from '@onekeyhq/kit/src/views/Account/ImportedAccount';
import WatchedAccount from '@onekeyhq/kit/src/views/Account/WatchedAccount';
import BackupTips from '@onekeyhq/kit/src/views/BackupTips';
import CreateWallet from '@onekeyhq/kit/src/views/CreateWallet';
import AddImportedAccount from '@onekeyhq/kit/src/views/CreateWallet/Account/AddImportedAccount';
import AddImportedAccountDone from '@onekeyhq/kit/src/views/CreateWallet/Account/AddImportedAccountDone';
import AddWatchAccount from '@onekeyhq/kit/src/views/CreateWallet/Account/AddWatchAccount';
import AddExistingWallet from '@onekeyhq/kit/src/views/CreateWallet/AddExistingWallet';
import AppWallet from '@onekeyhq/kit/src/views/CreateWallet/AppWallet/AppWallet';
import AppWalletDone from '@onekeyhq/kit/src/views/CreateWallet/AppWallet/Done';
import ImportWallet from '@onekeyhq/kit/src/views/CreateWallet/AppWallet/ImportWallet';
import RestoreFromMnemonic from '@onekeyhq/kit/src/views/CreateWallet/AppWallet/RestoreFromMnemonic';
import RestoreWallet from '@onekeyhq/kit/src/views/CreateWallet/AppWallet/RestoreWallet';
import Guide from '@onekeyhq/kit/src/views/CreateWallet/Guide';
import ConnectHardware, {
  Device,
} from '@onekeyhq/kit/src/views/CreateWallet/HardwareWallet/ConnectHardware';
import DeviceStatusCheck from '@onekeyhq/kit/src/views/CreateWallet/HardwareWallet/DeviceStatusCheck';
import RestoreHardwareWallet from '@onekeyhq/kit/src/views/CreateWallet/HardwareWallet/RestoreHardwareWallet';
import RestoreHardwareWalletDescription from '@onekeyhq/kit/src/views/CreateWallet/HardwareWallet/RestoreHardwareWalletDescription';
import SetupHardware from '@onekeyhq/kit/src/views/CreateWallet/HardwareWallet/SetupHardware';
import SetupNewDevice from '@onekeyhq/kit/src/views/CreateWallet/HardwareWallet/SetupNewDevice';
import SetupSuccess from '@onekeyhq/kit/src/views/CreateWallet/HardwareWallet/SetupSuccess';
import OnekeyLiteBackup from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/Backup';
import OnekeyLitePinCode from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/PinCode';
import OnekeyLiteRestore from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/Restore';
import OnekeyLiteRestoreDoneView from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/Restore/Done';

import createStackNavigator from './createStackNavigator';

export enum CreateWalletModalRoutes {
  CreateWalletModal = 'CreateWalletModal',
  ConnectHardwareModal = 'ConnectHardwareModal',
  AppWalletModal = 'AppWalletModal',
  AppWalletDoneModal = 'AppWalletDoneModal',
  RestoreWalletModal = 'RestoreWalletModal',
  RestoreFromMnemonicModal = 'RestoreFromMnemonicModal',
  SetupSuccessModal = 'SetupSuccessModal',
  SetupHardwareModal = 'SetupHardwareModal',
  SetupNewDeviceModal = 'SetupNewDeviceModal',
  DeviceStatusCheckModal = 'DeviceStatusCheckModal',
  RestoreHardwareWalletModal = 'RestoreHardwareWalletModal',
  RestoreHardwareWalletDescriptionModal = 'RestoreHardwareWalletDescriptionModal',
  ImportWalletModal = 'ImportWalletModal',
  CreateWatchedAccount = 'CreateWatchedAccount',
  CreateImportedAccount = 'CreateImportedAccount',
  BackupTipsModal = 'BackupTipsModal',

  // Onekey Lite backup
  OnekeyLitePinCodeVerifyModal = 'OnekeyLitePinCodeVerifyModal',
  OnekeyLiteRestoreModal = 'OnekeyLiteRestoreModal',
  OnekeyLiteRestoreDoneModal = 'OnekeyLiteRestoreDoneModal',
  OnekeyLiteBackupModal = 'OnekeyLiteBackupModal',

  AddExistingWalletModal = 'AddExistingWalletModal',
  GuideModal = 'GuideModal',
  AddImportedAccountModal = 'AddImportedAccountModal',
  AddImportedAccountDoneModal = 'AddImportedAccountDoneModal',
  AddWatchAccountModal = 'AddWatchAccount',
}

export type CreateWalletRoutesParams = {
  [CreateWalletModalRoutes.CreateWalletModal]: undefined;
  [CreateWalletModalRoutes.ConnectHardwareModal]: undefined;
  [CreateWalletModalRoutes.AppWalletModal]: undefined;
  [CreateWalletModalRoutes.AppWalletDoneModal]:
    | { mnemonic?: string }
    | undefined;
  [CreateWalletModalRoutes.RestoreWalletModal]: undefined;
  [CreateWalletModalRoutes.RestoreFromMnemonicModal]: undefined;
  [CreateWalletModalRoutes.SetupSuccessModal]: { device: Device };
  [CreateWalletModalRoutes.SetupHardwareModal]: { device: Device };
  [CreateWalletModalRoutes.SetupNewDeviceModal]: { device: Device };
  [CreateWalletModalRoutes.DeviceStatusCheckModal]: { device: Device };
  [CreateWalletModalRoutes.RestoreHardwareWalletModal]: { device: Device };
  [CreateWalletModalRoutes.RestoreHardwareWalletDescriptionModal]: {
    device: Device;
  };
  [CreateWalletModalRoutes.ImportWalletModal]: undefined;
  [CreateWalletModalRoutes.CreateImportedAccount]: undefined;
  [CreateWalletModalRoutes.CreateWatchedAccount]: undefined;
  [CreateWalletModalRoutes.AddExistingWalletModal]: {
    mode: 'all' | 'mnemonic' | 'address' | 'privatekey';
  };
  [CreateWalletModalRoutes.AddImportedAccountModal]: { privatekey: string };
  [CreateWalletModalRoutes.AddImportedAccountDoneModal]: {
    privatekey: string;
    networkId: string;
    name: string;
  };
  [CreateWalletModalRoutes.AddWatchAccountModal]: { address: string };
  [CreateWalletModalRoutes.GuideModal]: undefined;
  [CreateWalletModalRoutes.BackupTipsModal]: {
    walletId: string;
  };

  // Onekey Lite backup
  [CreateWalletModalRoutes.OnekeyLitePinCodeVerifyModal]: {
    callBack: (pwd: string) => boolean;
  };
  [CreateWalletModalRoutes.OnekeyLiteRestoreModal]: {
    pwd: string;
    onRetry: () => void;
  };
  [CreateWalletModalRoutes.OnekeyLiteRestoreDoneModal]: {
    onSuccess: (password: string) => void;
    onCancel: () => void;
  };
  [CreateWalletModalRoutes.OnekeyLiteBackupModal]: {
    walletId: string | null;
    pwd: string;
    backupData: string;
    onRetry: () => void;
    onSuccess: () => void;
  };
};

const CreateWalletNavigator = createStackNavigator<CreateWalletRoutesParams>();

const modalRoutes = [
  {
    name: CreateWalletModalRoutes.CreateWalletModal,
    component: CreateWallet,
  },
  {
    name: CreateWalletModalRoutes.ConnectHardwareModal,
    component: ConnectHardware,
  },
  {
    name: CreateWalletModalRoutes.AppWalletModal,
    component: AppWallet,
  },
  {
    name: CreateWalletModalRoutes.RestoreWalletModal,
    component: RestoreWallet,
  },
  {
    name: CreateWalletModalRoutes.RestoreFromMnemonicModal,
    component: RestoreFromMnemonic,
  },
  {
    name: CreateWalletModalRoutes.SetupSuccessModal,
    component: SetupSuccess,
  },
  {
    name: CreateWalletModalRoutes.SetupHardwareModal,
    component: SetupHardware,
  },
  {
    name: CreateWalletModalRoutes.SetupNewDeviceModal,
    component: SetupNewDevice,
  },
  {
    name: CreateWalletModalRoutes.DeviceStatusCheckModal,
    component: DeviceStatusCheck,
  },
  {
    name: CreateWalletModalRoutes.RestoreHardwareWalletModal,
    component: RestoreHardwareWallet,
  },
  {
    name: CreateWalletModalRoutes.RestoreHardwareWalletDescriptionModal,
    component: RestoreHardwareWalletDescription,
  },
  {
    name: CreateWalletModalRoutes.AppWalletDoneModal,
    component: AppWalletDone,
  },
  {
    name: CreateWalletModalRoutes.ImportWalletModal,
    component: ImportWallet,
  },
  {
    name: CreateWalletModalRoutes.CreateWatchedAccount,
    component: WatchedAccount,
  },
  {
    name: CreateWalletModalRoutes.CreateImportedAccount,
    component: ImportedAccount,
  },
  {
    name: CreateWalletModalRoutes.BackupTipsModal,
    component: BackupTips,
  },

  // Onekey Lite backup
  {
    name: CreateWalletModalRoutes.OnekeyLitePinCodeVerifyModal,
    component: OnekeyLitePinCode,
  },
  {
    name: CreateWalletModalRoutes.OnekeyLiteRestoreModal,
    component: OnekeyLiteRestore,
  },
  {
    name: CreateWalletModalRoutes.OnekeyLiteRestoreDoneModal,
    component: OnekeyLiteRestoreDoneView,
  },
  {
    name: CreateWalletModalRoutes.OnekeyLiteBackupModal,
    component: OnekeyLiteBackup,
  },
  {
    name: CreateWalletModalRoutes.AddExistingWalletModal,
    component: AddExistingWallet,
  },
  {
    name: CreateWalletModalRoutes.GuideModal,
    component: Guide,
  },
  {
    name: CreateWalletModalRoutes.AddImportedAccountModal,
    component: AddImportedAccount,
  },
  {
    name: CreateWalletModalRoutes.AddImportedAccountDoneModal,
    component: AddImportedAccountDone,
  },
  {
    name: CreateWalletModalRoutes.AddWatchAccountModal,
    component: AddWatchAccount,
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
