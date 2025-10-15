export enum EOnboardingPagesV2 {
  GetStarted = 'GetStarted',
  AddExistingWallet = 'AddExistingWallet',
  ImportPhraseOrPrivateKey = 'ImportPhraseOrPrivateKey',
  FinalizeWalletSetup = 'FinalizeWalletSetup',
}

export type IOnboardingParamListV2 = {
  [EOnboardingPagesV2.GetStarted]: {
    fromExt?: boolean;
  };
  [EOnboardingPagesV2.AddExistingWallet]: undefined;
  [EOnboardingPagesV2.ImportPhraseOrPrivateKey]: undefined;
  [EOnboardingPagesV2.FinalizeWalletSetup]: undefined;
};
