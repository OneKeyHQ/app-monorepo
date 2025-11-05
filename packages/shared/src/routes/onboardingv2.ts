import type { IConnectYourDeviceItem } from '../../types/device';
import type { EMnemonicType } from '../utils/secret';
import type { KnownDevice, SearchDevice } from '@onekeyfe/hd-core';
import type { EDeviceType } from '@onekeyfe/hd-shared';

export enum EOnboardingV2Routes {
  OnboardingV2 = 'OnboardingV2',
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
  BackupWalletReminder = 'BackupWalletReminder',
  ShowRecoveryPhrase = 'ShowRecoveryPhrase',
  VerifyRecoveryPhrase = 'VerifyRecoveryPhrase',
  SelectPrivateKeyNetwork = 'SelectPrivateKeyNetwork',
  ICloudBackup = 'ICloudBackup',
  ICloudBackupDetails = 'ICloudBackupDetails',
  ConnectWalletSelectNetworks = 'ConnectWalletSelectNetworks',
  ConnectExternalWallet = 'ConnectExternalWallet',
  ImportKeyTag = 'ImportKeyTag',
}

export type IOnboardingParamListV2 = {
  [EOnboardingPagesV2.GetStarted]: {
    fromExt?: boolean;
  };
  [EOnboardingPagesV2.AddExistingWallet]: undefined;
  [EOnboardingPagesV2.CreateOrImportWallet]: undefined;
  [EOnboardingPagesV2.FinalizeWalletSetup]: {
    mnemonic?: string;
    mnemonicType?: EMnemonicType;
    isWalletBackedUp?: boolean;
  };
  [EOnboardingPagesV2.PickYourDevice]: undefined;
  [EOnboardingPagesV2.ConnectYourDevice]: {
    deviceType: EDeviceType[];
  };
  [EOnboardingPagesV2.ConnectQRCode]: {
    deviceType: EDeviceType[];
  };
  [EOnboardingPagesV2.CheckAndUpdate]: {
    deviceData: IConnectYourDeviceItem;
  };
  [EOnboardingPagesV2.ImportPhraseOrPrivateKey]: undefined;
  [EOnboardingPagesV2.BackupWalletReminder]: undefined;
  [EOnboardingPagesV2.ShowRecoveryPhrase]: undefined;
  [EOnboardingPagesV2.VerifyRecoveryPhrase]: undefined;
  [EOnboardingPagesV2.SelectPrivateKeyNetwork]: {
    privateKey: string;
  };
  [EOnboardingPagesV2.ICloudBackup]: undefined;
  [EOnboardingPagesV2.ICloudBackupDetails]: {
    backupTime: number;
    backupId?: string;
    actionType: 'backup' | 'restore';
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
};
