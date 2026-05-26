import type { IKeylessWalletDetailsInfo } from '@onekeyhq/kit-bg/src/dbs/local/types';

import type { EConnectDeviceChannel } from '../../types/connectDevice';
import type {
  EHardwareVendor,
  IConnectYourDeviceItem,
} from '../../types/device';
import type { EOAuthSocialLoginProvider } from '../consts/authConsts';
import type { EKeylessFinalizeAction } from '../keylessWallet/keylessWalletConsts';
import type { IDetectedNetworkGroupItem } from '../utils/networkDetectUtils';
import type { EMnemonicType } from '../utils/secret';
import type { EDeviceType } from '@onekeyfe/hd-shared';

export enum EOnboardingV2Routes {
  OnboardingV2 = 'OnboardingV2',
}

export enum EOnboardingV2ImportPhraseOrPrivateKeyTab {
  Phrase = 'phrase',
  PrivateKey = 'privateKey',
}

export enum EOnboardingV2KeylessWalletCreationMode {
  Create = 'Create',
  Restore = 'Restore',
  View = 'View',
}

export enum EOnboardingV2OneKeyIDLoginMode {
  KeylessCreateOrRestore = 'KeylessCreateOrRestore',
  KeylessResetPin = 'KeylessResetPin',
  KeylessVerifyPinOnly = 'KeylessVerifyPinOnly',
}

export enum EOnboardingPagesV2 {
  GetStarted = 'GetStarted',
  CreateNewWallet = 'CreateNewWallet',
  CreateOrImportWallet = 'CreateOrImportWallet',
  FinalizeWalletSetup = 'FinalizeWalletSetup',
  PickYourDevice = 'PickYourDevice',
  ConnectYourDevice = 'ConnectYourDevice',
  ConnectQRCode = 'ConnectQRCode',
  CheckAndUpdate = 'CheckAndUpdate',
  ImportPhraseOrPrivateKey = 'ImportPhraseOrPrivateKey',
  ImportWatchedAccount = 'ImportWatchedAccount',
  BackupWalletReminder = 'BackupWalletReminder',
  ShowRecoveryPhrase = 'ShowRecoveryPhrase',
  VerifyRecoveryPhrase = 'VerifyRecoveryPhrase',
  SelectPrivateKeyNetwork = 'SelectPrivateKeyNetwork',
  ICloudBackup = 'ICloudBackup',
  ICloudBackupDetails = 'ICloudBackupDetails',
  ConnectWalletSelectNetworks = 'ConnectWalletSelectNetworks',
  ConnectExternalWallet = 'ConnectExternalWallet',
  ImportKeyTag = 'ImportKeyTag',
  KeylessWalletRecovery = 'KeylessWalletRecovery',
  KeylessWalletCreation = 'KeylessWalletCreation',
  OneKeyIDLogin = 'OneKeyIDLogin',
  CreatePin = 'CreatePin',
  ConfirmPin = 'ConfirmPin',
  VerifyPin = 'VerifyPin',
  ResetPinGuide = 'ResetPinGuide',
  NewPinCreated = 'NewPinCreated',
  CreatePasscode = 'CreatePasscode',
}
interface IVerifyRecoveryPhraseParams {
  mnemonic: string;
  isWalletBackedUp?: boolean;
  walletId: string;
  accountName?: string;
}

export type IOnboardingAutoConnectOrigin = string;

export type IOnboardingParamListV2 = {
  [EOnboardingPagesV2.GetStarted]: undefined;
  [EOnboardingPagesV2.CreateNewWallet]: {
    fromExt?: boolean;
    autoConnectOrigin?: IOnboardingAutoConnectOrigin;
    autoLoginKeylessProvider?: EOAuthSocialLoginProvider;
    autoConnectNonce?: string;
  };
  [EOnboardingPagesV2.CreateOrImportWallet]: undefined;
  [EOnboardingPagesV2.FinalizeWalletSetup]: {
    mnemonic?: string;
    mnemonicType?: EMnemonicType;
    isWalletBackedUp?: boolean;
    isKeylessWallet?: boolean;
    shouldAutoResetKeylessPinAfterRestore?: boolean;
    isFirmwareVerified?: boolean;
    deviceData?: IConnectYourDeviceItem;
    // User-selected connection channel for this session. Carried forward from
    // the Ledger entry points (ConnectionFlowLedger / ConnectYourDevice Ledger
    // branch) so the analytics `walletAdded` event can attribute the actual
    // per-session transport (via getForceTransportType) rather than the stale
    // persisted hardwareTransportType setting.
    tabValue?: EConnectDeviceChannel;
    keylessPackSetId?: string;
    keylessOwnerId?: string;
    keylessDetailsInfo?: IKeylessWalletDetailsInfo;
  };
  [EOnboardingPagesV2.PickYourDevice]: undefined;
  [EOnboardingPagesV2.ConnectYourDevice]: {
    deviceType: EDeviceType[];
    vendor?: EHardwareVendor;
  };
  [EOnboardingPagesV2.ConnectQRCode]: undefined;
  [EOnboardingPagesV2.CheckAndUpdate]: {
    deviceData: IConnectYourDeviceItem;
    tabValue: EConnectDeviceChannel;
  };
  [EOnboardingPagesV2.ImportPhraseOrPrivateKey]: {
    defaultTab: EOnboardingV2ImportPhraseOrPrivateKeyTab;
  };
  [EOnboardingPagesV2.ImportWatchedAccount]: undefined;
  [EOnboardingPagesV2.BackupWalletReminder]: IVerifyRecoveryPhraseParams;
  [EOnboardingPagesV2.ShowRecoveryPhrase]: IVerifyRecoveryPhraseParams;
  [EOnboardingPagesV2.VerifyRecoveryPhrase]: IVerifyRecoveryPhraseParams;
  [EOnboardingPagesV2.SelectPrivateKeyNetwork]: {
    input: string;
    detectedNetworks: IDetectedNetworkGroupItem[];
    importType: 'privateKey' | 'address' | 'publicKey';
  };
  [EOnboardingPagesV2.ICloudBackup]: {
    hideRestoreButton?: boolean;
  };
  [EOnboardingPagesV2.ICloudBackupDetails]: {
    backupTime: number;
    backupId?: string;
    actionType: 'backup' | 'restore';
    hideRestoreButton?: boolean;
  };
  [EOnboardingPagesV2.ConnectWalletSelectNetworks]: {
    impl: string;
    title: string;
  };
  [EOnboardingPagesV2.ConnectExternalWallet]: {
    impl: string;
    title: string;
  };
  [EOnboardingPagesV2.ImportKeyTag]: undefined;
  [EOnboardingPagesV2.KeylessWalletRecovery]: {
    email?: string;
  };
  [EOnboardingPagesV2.KeylessWalletCreation]: {
    email?: string;
    mode?: EOnboardingV2KeylessWalletCreationMode;
  };
  [EOnboardingPagesV2.OneKeyIDLogin]: {
    mode: EOnboardingV2OneKeyIDLoginMode;
    provider?: EOAuthSocialLoginProvider;
  };
  [EOnboardingPagesV2.CreatePin]: {
    action?: EKeylessFinalizeAction;
  };
  [EOnboardingPagesV2.ConfirmPin]: {
    action?: EKeylessFinalizeAction;
  };
  [EOnboardingPagesV2.CreatePasscode]: {
    action?: EKeylessFinalizeAction;
    mnemonic?: string;
    isWalletBackedUp?: boolean;
  };
  [EOnboardingPagesV2.VerifyPin]: {
    mode?: EOnboardingV2OneKeyIDLoginMode;
  };
  [EOnboardingPagesV2.ResetPinGuide]: undefined;
  [EOnboardingPagesV2.NewPinCreated]: undefined;
};
