export enum ETestModalPages {
  NetworkFeeSubsidy = 'NetworkFeeSubsidy',
  TestSimpleModal = 'TestSimpleModal',
}

export type ITestModalPagesParam = {
  [ETestModalPages.NetworkFeeSubsidy]: undefined;
  [ETestModalPages.TestSimpleModal]: { question: string };
};
