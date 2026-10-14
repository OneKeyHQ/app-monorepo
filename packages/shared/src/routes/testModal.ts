export enum ETestModalPages {
  NetworkFeeSubsidy = 'NetworkFeeSubsidy',
  TestSimpleModal = 'TestSimpleModal',
}

export type ITronClaimDemoScenario =
  | 'available'
  | 'claimed'
  | 'exhausted'
  | 'monthlyLimit'
  | 'ipLimit'
  | 'inactive'
  | 'watching'
  | 'missingAccount'
  | 'failed';

export type ITestModalPagesParam = {
  [ETestModalPages.NetworkFeeSubsidy]: {
    initialSignedIn: boolean;
    tronClaimScenario?: ITronClaimDemoScenario;
  };
  [ETestModalPages.TestSimpleModal]: { question: string };
};
