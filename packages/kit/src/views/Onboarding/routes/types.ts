import { EOnboardingRoutes } from './enums';

export type IOnboardingRecoveryPhraseParams = {
  password: string;
  withEnableAuthentication?: boolean;
  mnemonic: string;
};
export type IOnboardingRoutesParams = {
  [EOnboardingRoutes.Welcome]: undefined;

  [EOnboardingRoutes.ConnectWallet]: undefined;
  [EOnboardingRoutes.ConnectHardwareModal]: undefined;

  [EOnboardingRoutes.ImportWallet]: undefined;

  [EOnboardingRoutes.SetPassword]: undefined;
  [EOnboardingRoutes.RecoveryPhrase]: IOnboardingRecoveryPhraseParams;
  [EOnboardingRoutes.ShowRecoveryPhrase]: IOnboardingRecoveryPhraseParams;
  [EOnboardingRoutes.BehindTheScene]: IOnboardingRecoveryPhraseParams;
};
