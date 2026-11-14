export enum ETestModalPages {
  NetworkFeeSubsidy = 'NetworkFeeSubsidy',
  NetworkFeeSubsidyHistory = 'NetworkFeeSubsidyHistory',
  TestSimpleModal = 'TestSimpleModal',
}

export type ITestModalPagesParam = {
  [ETestModalPages.NetworkFeeSubsidy]: undefined;
  [ETestModalPages.NetworkFeeSubsidyHistory]: undefined;
  [ETestModalPages.TestSimpleModal]: { question: string };
};
