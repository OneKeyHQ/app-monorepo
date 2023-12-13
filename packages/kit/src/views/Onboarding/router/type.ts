export enum EOnboardingPages {
  GetStarted = 'GetStarted',
  ShowRecoveryPhrase = 'ShowRecoveryPhrase',
  ImportRecoveryPhrase = 'ImportRecoveryPhrase',
  ConnectHardwareWallet = 'ConnectHardwareWallet',
}

export type IOnboardingParamList = {
  [EOnboardingPages.GetStarted]: undefined;
  [EOnboardingPages.ShowRecoveryPhrase]: undefined;
  [EOnboardingPages.ImportRecoveryPhrase]: undefined;
  [EOnboardingPages.ConnectHardwareWallet]: undefined;
};
