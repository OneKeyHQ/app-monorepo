export enum EOnboardingV2Routes {
  OnboardingV2 = 'OnboardingV2',
}

export enum EOnboardingPagesV2 {
  GetStarted = 'GetStarted',
  AddExistingWallet = 'AddExistingWallet',
  ImportPhraseOrPrivateKey = 'ImportPhraseOrPrivateKey',
  FinalizeWalletSetup = 'FinalizeWalletSetup',
  PickYourDevice = 'PickYourDevice',
}

export type IOnboardingParamListV2 = {
  [EOnboardingPagesV2.GetStarted]: {
    fromExt?: boolean;
  };
  [EOnboardingPagesV2.AddExistingWallet]: undefined;
  [EOnboardingPagesV2.ImportPhraseOrPrivateKey]: undefined;
  [EOnboardingPagesV2.FinalizeWalletSetup]: undefined;
  [EOnboardingPagesV2.PickYourDevice]: undefined;
};
