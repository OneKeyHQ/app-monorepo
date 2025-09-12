import type { EMnemonicType } from '@onekeyhq/core/src/secret';

import type { EConnectDeviceChannel } from '../../types/connectDevice';
import type { IWalletConnectConnectToWalletParams } from '../walletConnect/types';
import type { IDeviceType } from '@onekeyfe/hd-core';

export enum EOnboardingPages {
  GetStarted = 'GetStarted',

  // v4 migration
  V4MigrationGetStarted = 'V4MigrationGetStarted',
  V4MigrationPreview = 'V4MigrationPreview',
  V4MigrationProcess = 'V4MigrationProcess',
  V4MigrationDone = 'V4MigrationDone',

  // connect hardware wallet
  ConnectYourDevice = 'ConnectYourDevice',
  OneKeyHardwareWallet = 'OneKeyHardwareWallet',
  ActivateDevice = 'ActivateDevice',

  // create wallet
  BeforeShowRecoveryPhrase = 'BeforeShowRecoveryPhrase',
  RecoveryPhrase = 'RecoveryPhrase',
  VerifyRecoverPhrase = 'VerifyRecoverPhrase',

  // import wallet
  ImportWalletOptions = 'ImportWalletOptions',
  ImportRecoveryPhrase = 'ImportRecoveryPhrase',
  ImportPrivateKey = 'ImportPrivateKey',
  ImportAddress = 'ImportAddress',
  ImportCloudBackup = 'ImportCloudBackup',

  // connect 3rd-party wallet
  ConnectWallet = 'ConnectWallet',
  ConnectWalletOptions = 'ConnectWalletOptions',
  ConnectWalletSelectNetworks = 'ConnectWalletSelectNetworks',

  // finalize wallet setup
  FinalizeWalletSetup = 'FinalizeWalletSetup',
  ImportKeyTag = 'ImportKeyTag',

  // device management guide page
  DeviceManagementGuide = 'DeviceManagementGuide',

  // prompt web device access
  PromptWebDeviceAccess = 'PromptWebDeviceAccess',
}

export type IOnboardingParamList = {
  [EOnboardingPages.GetStarted]: {
    isFullModal?: boolean;
    fromExt?: boolean;
  };

  // v4 migration
  [EOnboardingPages.V4MigrationGetStarted]: {
    isAutoStartOnMount?: boolean;
  };
  [EOnboardingPages.V4MigrationPreview]: undefined;
  [EOnboardingPages.V4MigrationProcess]: undefined;
  [EOnboardingPages.V4MigrationDone]: undefined;

  // connect hardware wallet
  [EOnboardingPages.ConnectYourDevice]: {
    channel?: EConnectDeviceChannel;
  };
  [EOnboardingPages.OneKeyHardwareWallet]: undefined;
  [EOnboardingPages.ActivateDevice]: {
    tutorialType: 'create' | 'restore';
    deviceType: IDeviceType;
  };

  // create wallet
  [EOnboardingPages.BeforeShowRecoveryPhrase]: {
    mnemonic?: string;
    isBackup?: boolean;
    isWalletBackedUp?: boolean;
    walletId?: string;
  };
  [EOnboardingPages.RecoveryPhrase]: {
    mnemonic?: string;
    isBackup?: boolean;
    isWalletBackedUp?: boolean;
    walletId?: string;
  };
  [EOnboardingPages.VerifyRecoverPhrase]: {
    mnemonic: string;
    verifyRecoveryPhrases?: string[][][];
    isBackup?: boolean;
    isWalletBackedUp?: boolean;
    walletId?: string;
  };

  // import wallet
  [EOnboardingPages.ImportWalletOptions]: undefined;
  [EOnboardingPages.ImportRecoveryPhrase]: undefined;
  [EOnboardingPages.ImportPrivateKey]: undefined;
  [EOnboardingPages.ImportAddress]: undefined;
  [EOnboardingPages.ImportCloudBackup]: undefined;
  [EOnboardingPages.ImportKeyTag]: undefined;

  // connect 3rd-party wallet
  [EOnboardingPages.ConnectWallet]: IWalletConnectConnectToWalletParams & {
    title: string;
  };
  [EOnboardingPages.ConnectWalletOptions]: {
    defaultTab?: 'onekey' | 'others';
  };
  [EOnboardingPages.ConnectWalletSelectNetworks]: undefined;

  // finalize wallet setup
  [EOnboardingPages.FinalizeWalletSetup]: {
    mnemonic?: string;
    mnemonicType?: EMnemonicType;
    isWalletBackedUp?: boolean;
  };

  // device management guide page
  [EOnboardingPages.DeviceManagementGuide]: undefined;
};
