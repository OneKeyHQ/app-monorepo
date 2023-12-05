export enum ETestModalPages {
  TestSimpleModal = 'TestSimpleModal',
}

export type ITestModalPagesParam = {
  [ETestModalPages.TestSimpleModal]: { question: string };
};
