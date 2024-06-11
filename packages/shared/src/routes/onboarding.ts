import type { IWalletConnectConnectToWalletParams } from '../walletConnect/types';
import type { IDeviceType } from '@onekeyfe/hd-core';

export enum EOnboardingPages {
  GetStarted = 'GetStarted',
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
  ConnectWalletSelectNetworks = 'ConnectWalletSelectNetworks',

  // finalize wallet setup
  FinalizeWalletSetup = 'FinalizeWalletSetup',
  ImportKeyTag = 'ImportKeyTag',
}

export type IOnboardingParamList = {
  [EOnboardingPages.GetStarted]: {
    showCloseButton?: boolean;
  };
  // connect hardware wallet
  [EOnboardingPages.ConnectYourDevice]: undefined;
  [EOnboardingPages.OneKeyHardwareWallet]: undefined;
  [EOnboardingPages.ActivateDevice]: {
    tutorialType: 'create' | 'restore';
    deviceType: IDeviceType;
  };

  // create wallet
  [EOnboardingPages.BeforeShowRecoveryPhrase]: {
    mnemonic?: string;
    isBackup?: boolean;
  };
  [EOnboardingPages.RecoveryPhrase]: {
    mnemonic?: string;
    isBackup?: boolean;
  };
  [EOnboardingPages.VerifyRecoverPhrase]: {
    mnemonic: string;
    verifyRecoveryPhrases?: string[][][];
    isBackup?: boolean;
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
  [EOnboardingPages.ConnectWalletSelectNetworks]: undefined;

  // finalize wallet setup
  [EOnboardingPages.FinalizeWalletSetup]: {
    mnemonic?: string;
  };
};
