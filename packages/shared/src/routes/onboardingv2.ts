export enum EOnboardingPagesV2 {
  GetStarted = 'GetStarted',
}

export type IOnboardingParamListV2 = {
  [EOnboardingPagesV2.GetStarted]: {
    fromExt?: boolean;
  };
};
