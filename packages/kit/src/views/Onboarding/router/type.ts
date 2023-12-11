export enum EOnboardingPages {
  GetStarted = 'GetStarted',
  RecoveryPhrase = 'RecoveryPhrase',
  ImportRecoveryPhrase = 'ImportRecoveryPhrase',
}

export type IOnboardingParamList = {
  [EOnboardingPages.GetStarted]: undefined;
  [EOnboardingPages.RecoveryPhrase]: undefined;
  [EOnboardingPages.ImportRecoveryPhrase]: undefined;
};
