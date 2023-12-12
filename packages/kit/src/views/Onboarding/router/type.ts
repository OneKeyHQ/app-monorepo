export enum EOnboardingPages {
  GetStarted = 'GetStarted',
  ShowRecoveryPhrase = 'ShowRecoveryPhrase',
  ImportRecoveryPhrase = 'ImportRecoveryPhrase',
}

export type IOnboardingParamList = {
  [EOnboardingPages.GetStarted]: undefined;
  [EOnboardingPages.ShowRecoveryPhrase]: undefined;
  [EOnboardingPages.ImportRecoveryPhrase]: undefined;
};
