export enum EOnboardingPages {
  GetStarted = 'GetStarted',
  // connect hardware wallet
  ConnectYourDevice = 'ConnectYourDevice',
  OneKeyHardwareWallet = 'OneKeyHardwareWallet',
  SetupNewWallet = 'SetupNewWallet',
  RestoreWallet = 'RestoreWallet',

  // create wallet
  BeforeShowRecoveryPhrase = 'BeforeShowRecoveryPhrase',
  RecoveryPhrase = 'RecoveryPhrase',

  // import wallet
  ImportRecoveryPhrase = 'ImportRecoveryPhrase',

  // import private key
  ImportPrivateKey = 'ImportPrivateKey',

  // import address
  ImportAddress = 'ImportAddress',

  // finalize wallet setup
  FinalizeWalletSetup = 'FinalizeWalletSetup',
}

export type IOnboardingParamList = {
  [EOnboardingPages.GetStarted]: undefined;
  // connect hardware wallet
  [EOnboardingPages.ConnectYourDevice]: undefined;
  [EOnboardingPages.OneKeyHardwareWallet]: undefined;
  [EOnboardingPages.SetupNewWallet]: undefined;
  [EOnboardingPages.RestoreWallet]: undefined;

  // create wallet
  [EOnboardingPages.BeforeShowRecoveryPhrase]: undefined;
  [EOnboardingPages.RecoveryPhrase]: undefined;

  // import wallet
  [EOnboardingPages.ImportRecoveryPhrase]: undefined;

  // import private key
  [EOnboardingPages.ImportPrivateKey]: undefined;

  // import address
  [EOnboardingPages.ImportAddress]: undefined;

  // finalize wallet setup
  [EOnboardingPages.FinalizeWalletSetup]: undefined;
};
