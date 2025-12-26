import type { EConnectDeviceChannel } from '../../types/connectDevice';
import type { IConnectYourDeviceItem } from '../../types/device';
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

export enum EOnboardingPagesV2 {
  GetStarted = 'GetStarted',
  AddExistingWallet = 'AddExistingWallet',
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
  MoreAction = 'MoreAction',
}
interface IVerifyRecoveryPhraseParams {
  mnemonic: string;
  isWalletBackedUp?: boolean;
  walletId: string;
  accountName?: string;
}

export type IOnboardingParamListV2 = {
  [EOnboardingPagesV2.GetStarted]: {
    fromExt?: boolean;
  };
  [EOnboardingPagesV2.AddExistingWallet]: undefined;
  [EOnboardingPagesV2.CreateOrImportWallet]: {
    fullOptions?: boolean;
  };
  [EOnboardingPagesV2.FinalizeWalletSetup]: {
    mnemonic?: string;
    mnemonicType?: EMnemonicType;
    isWalletBackedUp?: boolean;
    isFirmwareVerified?: boolean;
    deviceData?: IConnectYourDeviceItem;
    keylessPackSetId?: string;
  };
  [EOnboardingPagesV2.PickYourDevice]: undefined;
  [EOnboardingPagesV2.ConnectYourDevice]: {
    deviceType: EDeviceType[];
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
  [EOnboardingPagesV2.MoreAction]: undefined;
};
