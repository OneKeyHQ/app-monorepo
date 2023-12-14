export enum EOnboardingPages {
  GetStarted = 'GetStarted',
  BeforeShowRecoveryPhrase = 'BeforeShowRecoveryPhrase',
  ImportRecoveryPhrase = 'ImportRecoveryPhrase',
  OneKeyHardwareWallet = 'OneKeyHardwareWallet',
  LookingForDevices = 'LookingForDevices',
  ImportPrivateKey = 'ImportPrivateKey',
  ImportAddress = 'ImportAddress',
  RecoveryPhrase = 'RecoveryPhrase',
}

export type IOnboardingParamList = {
  [EOnboardingPages.GetStarted]: undefined;
  [EOnboardingPages.BeforeShowRecoveryPhrase]: undefined;
  [EOnboardingPages.ImportRecoveryPhrase]: undefined;
  [EOnboardingPages.OneKeyHardwareWallet]: undefined;
  [EOnboardingPages.LookingForDevices]: undefined;
  [EOnboardingPages.ImportPrivateKey]: undefined;
  [EOnboardingPages.ImportAddress]: undefined;
  [EOnboardingPages.RecoveryPhrase]: undefined;
};
