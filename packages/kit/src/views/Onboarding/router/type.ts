export enum EOnboardingPages {
  GetStarted = 'GetStarted',
  // connect hardware wallet
  ConnectYourDevice = 'ConnectYourDevice',
  OneKeyHardwareWallet = 'OneKeyHardwareWallet',
  ActivateDevice = 'ActivateDevice',

  // create wallet
  BeforeShowRecoveryPhrase = 'BeforeShowRecoveryPhrase',
  RecoveryPhrase = 'RecoveryPhrase',

  // import wallet
  ImportWalletOptions = 'ImportWalletOptions',
  ImportRecoveryPhrase = 'ImportRecoveryPhrase',
  ImportPrivateKey = 'ImportPrivateKey',
  ImportAddress = 'ImportAddress',

  // connect 3rd-party wallet
  ConnectWallet = 'ConnectWallet',

  // finalize wallet setup
  FinalizeWalletSetup = 'FinalizeWalletSetup',
}

export type IOnboardingParamList = {
  [EOnboardingPages.GetStarted]: undefined;
  // connect hardware wallet
  [EOnboardingPages.ConnectYourDevice]: undefined;
  [EOnboardingPages.OneKeyHardwareWallet]: undefined;
  [EOnboardingPages.ActivateDevice]: undefined;

  // create wallet
  [EOnboardingPages.BeforeShowRecoveryPhrase]: undefined;
  [EOnboardingPages.RecoveryPhrase]: undefined;

  // import wallet
  [EOnboardingPages.ImportWalletOptions]: undefined;
  [EOnboardingPages.ImportRecoveryPhrase]: undefined;
  [EOnboardingPages.ImportPrivateKey]: undefined;
  [EOnboardingPages.ImportAddress]: undefined;

  // connect 3rd-party wallet
  [EOnboardingPages.ConnectWallet]: undefined;

  // finalize wallet setup
  [EOnboardingPages.FinalizeWalletSetup]: undefined;
};
