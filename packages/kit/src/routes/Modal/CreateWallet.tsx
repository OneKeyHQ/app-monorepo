import { useIsVerticalLayout } from '@onekeyhq/components';
import type { IWallet } from '@onekeyhq/engine/src/types';
import type { Account } from '@onekeyhq/engine/src/types/account';
import type { UserInputCheckResult } from '@onekeyhq/engine/src/types/credential';
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';
import type { SearchDevice } from '@onekeyhq/kit/src/utils/hardware';
import AddImportedAccountDone from '@onekeyhq/kit/src/views/CreateWallet/Account/AddImportedAccountDone';
import AddImportedOrWatchingAccount from '@onekeyhq/kit/src/views/CreateWallet/Account/AddImportedOrWatchingAccount';
import AddExistingWallet from '@onekeyhq/kit/src/views/CreateWallet/AddExistingWallet';
import AttentionsView from '@onekeyhq/kit/src/views/CreateWallet/AppWallet/AttentionsView';
import AppWalletDone from '@onekeyhq/kit/src/views/CreateWallet/AppWallet/Done';
import Mnemonic from '@onekeyhq/kit/src/views/CreateWallet/AppWallet/Mnemonic';
import NewWallet from '@onekeyhq/kit/src/views/CreateWallet/AppWallet/NewWallet';
import ConnectHardware from '@onekeyhq/kit/src/views/CreateWallet/HardwareWallet/ConnectHardware';
import DeviceStatusCheck from '@onekeyhq/kit/src/views/CreateWallet/HardwareWallet/DeviceStatusCheck';
import RestoreHardwareWallet from '@onekeyhq/kit/src/views/CreateWallet/HardwareWallet/RestoreHardwareWallet';
import RestoreHardwareWalletDescription from '@onekeyhq/kit/src/views/CreateWallet/HardwareWallet/RestoreHardwareWalletDescription';
import SetupHardware from '@onekeyhq/kit/src/views/CreateWallet/HardwareWallet/SetupHardware';
import type { SetupNewDeviceType } from '@onekeyhq/kit/src/views/CreateWallet/HardwareWallet/SetupNewDevice';
import SetupNewDevice from '@onekeyhq/kit/src/views/CreateWallet/HardwareWallet/SetupNewDevice';
import SetupSuccess from '@onekeyhq/kit/src/views/CreateWallet/HardwareWallet/SetupSuccess';
import OnekeyLiteBackup from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/Backup';
import OnekeyLiteBackupPinCode from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/PinCode/BackupPinCodeVerify';
import OnekeyLiteRestorePinCode from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/PinCode/RestorePinCodeVerify';
import OnekeyLiteRestore from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/Restore';
import OnekeyLiteRestoreDoneView from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/Restore/Done';
import type {
  OnekeyLiteModalRoutes,
  OnekeyLiteRoutesParams,
} from '@onekeyhq/kit/src/views/Hardware/OnekeyLite/routes';

import { WalletConnectQrcodeModal } from '../../components/WalletConnect/WalletConnectQrcodeModal';
import { CreateWalletModalRoutes } from '../routesEnum';

import { buildModalStackNavigatorOptions } from './buildModalStackNavigatorOptions';
import createStackNavigator from './createStackNavigator';

import type { WalletService } from '../../components/WalletConnect/types';

export { CreateWalletModalRoutes };

export type IAddExistingWalletMode =
  | 'all'
  | 'mnemonic'
  | 'watching'
  | 'imported';
export type IAddExistingWalletModalParams = {
  mode: IAddExistingWalletMode;
  presetText?: string;
  wallet?: IWallet;
};
export type IAddImportedOrWatchingAccountModalParams = {
  defaultName?: string;
  text: string;
  checkResults: Array<UserInputCheckResult>;
  onSuccess?: (options: { wallet?: Wallet; account?: Account }) => void;
};
export type IAppWalletDoneModalParams = {
  mnemonic?: string;
  onSuccess?: (options: { wallet: Wallet }) => void;
};
export type IAddImportedAccountDoneModalParams = {
  privatekey: string;
  networkId: string;
  name: string;
  template?: string;
  onSuccess?: (options: { account: Account }) => void;
  onFailure?: () => void;
};
export type CreateWalletRoutesParams = {
  [CreateWalletModalRoutes.ConnectHardwareModal]: undefined;
  [CreateWalletModalRoutes.AttentionsModal]: {
    password: string;
    withEnableAuthentication?: boolean;
  };
  [CreateWalletModalRoutes.MnemonicModal]: {
    password: string;
    withEnableAuthentication?: boolean;
    mnemonic: string;
  };
  [CreateWalletModalRoutes.NewWalletModal]: undefined;
  [CreateWalletModalRoutes.AppWalletDoneModal]: IAppWalletDoneModalParams;
  [CreateWalletModalRoutes.SetupSuccessModal]: {
    device: SearchDevice;
    onPressOnboardingFinished?: () => Promise<void>;
  };
  [CreateWalletModalRoutes.SetupHardwareModal]: { device: SearchDevice };
  [CreateWalletModalRoutes.SetupNewDeviceModal]: {
    device: SearchDevice;
    type: SetupNewDeviceType;
  };
  [CreateWalletModalRoutes.DeviceStatusCheckModal]: { device: SearchDevice };
  [CreateWalletModalRoutes.RestoreHardwareWalletModal]: {
    device: SearchDevice;
  };
  [CreateWalletModalRoutes.RestoreHardwareWalletDescriptionModal]: {
    device: SearchDevice;
  };
  [CreateWalletModalRoutes.CreateImportedAccount]: undefined;
  [CreateWalletModalRoutes.CreateWatchedAccount]: undefined;
  [CreateWalletModalRoutes.AddExistingWalletModal]: IAddExistingWalletModalParams;
  [CreateWalletModalRoutes.AddImportedOrWatchingAccountModal]: IAddImportedOrWatchingAccountModalParams;
  [CreateWalletModalRoutes.AddImportedAccountDoneModal]: IAddImportedAccountDoneModalParams;

  // Onekey Lite Backup & Restore
  [CreateWalletModalRoutes.OnekeyLiteRestorePinCodeVerifyModal]: OnekeyLiteRoutesParams[OnekeyLiteModalRoutes.OnekeyLiteRestorePinCodeVerifyModal];
  [CreateWalletModalRoutes.OnekeyLiteRestoreModal]: OnekeyLiteRoutesParams[OnekeyLiteModalRoutes.OnekeyLiteRestoreModal];
  [CreateWalletModalRoutes.OnekeyLiteRestoreDoneModal]: OnekeyLiteRoutesParams[OnekeyLiteModalRoutes.OnekeyLiteRestoreDoneModal];
  [CreateWalletModalRoutes.OnekeyLiteBackupPinCodeVerifyModal]: OnekeyLiteRoutesParams[OnekeyLiteModalRoutes.OnekeyLiteBackupPinCodeVerifyModal];
  [CreateWalletModalRoutes.OnekeyLiteBackupModal]: OnekeyLiteRoutesParams[OnekeyLiteModalRoutes.OnekeyLiteBackupModal];
  [CreateWalletModalRoutes.WalletConnectQrcodeModal]: {
    connectToWalletService: (
      walletService: WalletService,
      uri?: string,
    ) => Promise<void>;
    uri?: string;
    onDismiss: () => void;
    shouldRenderQrcode: boolean;
  };
};

const CreateWalletNavigator = createStackNavigator<CreateWalletRoutesParams>();

const modalRoutes = [
  {
    name: CreateWalletModalRoutes.ConnectHardwareModal,
    component: ConnectHardware,
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

  // Onekey Lite backup
  {
    name: CreateWalletModalRoutes.OnekeyLiteRestorePinCodeVerifyModal,
    component: OnekeyLiteRestorePinCode,
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
    name: CreateWalletModalRoutes.OnekeyLiteBackupPinCodeVerifyModal,
    component: OnekeyLiteBackupPinCode,
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
    name: CreateWalletModalRoutes.WalletConnectQrcodeModal,
    component: WalletConnectQrcodeModal,
  },
  {
    name: CreateWalletModalRoutes.AddImportedOrWatchingAccountModal,
    component: AddImportedOrWatchingAccount,
  },
  {
    name: CreateWalletModalRoutes.AddImportedAccountDoneModal,
    component: AddImportedAccountDone,
  },
  {
    name: CreateWalletModalRoutes.AttentionsModal,
    component: AttentionsView,
  },
  {
    name: CreateWalletModalRoutes.MnemonicModal,
    component: Mnemonic,
  },
  {
    name: CreateWalletModalRoutes.NewWalletModal,
    component: NewWallet,
  },
];

const CreateWalletModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <CreateWalletNavigator.Navigator
      screenOptions={(navInfo) => ({
        ...buildModalStackNavigatorOptions({ isVerticalLayout, navInfo }),
      })}
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
