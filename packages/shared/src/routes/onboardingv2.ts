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
  CheckAndUpdate = 'CheckAndUpdate',
  ImportPhraseOrPrivateKey = 'ImportPhraseOrPrivateKey',
  ICloudBackup = 'ICloudBackup',
  ICloudBackupDetails = 'ICloudBackupDetails',
}

export type IOnboardingParamListV2 = {
  [EOnboardingPagesV2.GetStarted]: {
    fromExt?: boolean;
  };
  [EOnboardingPagesV2.AddExistingWallet]: undefined;
  [EOnboardingPagesV2.CreateOrImportWallet]: undefined;
  [EOnboardingPagesV2.FinalizeWalletSetup]: undefined;
  [EOnboardingPagesV2.PickYourDevice]: undefined;
  [EOnboardingPagesV2.ConnectYourDevice]: {
    deviceType: EDeviceType[];
  };
  [EOnboardingPagesV2.CheckAndUpdate]: undefined;
  [EOnboardingPagesV2.ImportPhraseOrPrivateKey]: undefined;
  [EOnboardingPagesV2.ICloudBackup]: undefined;
  [EOnboardingPagesV2.ICloudBackupDetails]: {
    backupTime: string;
  };
};
