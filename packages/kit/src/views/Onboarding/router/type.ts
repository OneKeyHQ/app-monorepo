export enum EOnboardingPages {
  GetStarted = 'GetStarted',
  ShowRecoveryPhrase = 'ShowRecoveryPhrase',
  ImportRecoveryPhrase = 'ImportRecoveryPhrase',
  ConnectHardwareWallet = 'ConnectHardwareWallet',
  ImportPrivateKey = 'ImportPrivateKey',
  ImportAddress = 'ImportAddress',
}

export type IOnboardingParamList = {
  [EOnboardingPages.GetStarted]: undefined;
  [EOnboardingPages.ShowRecoveryPhrase]: undefined;
  [EOnboardingPages.ImportRecoveryPhrase]: undefined;
  [EOnboardingPages.ConnectHardwareWallet]: undefined;
  [EOnboardingPages.ImportPrivateKey]: undefined;
  [EOnboardingPages.ImportAddress]: undefined;
};
