export enum EModalTestRoutes {
  TestSimpleModal = 'TestSimpleModal',
}

export type IModalTestParamList = {
  [EModalTestRoutes.TestSimpleModal]: { question: string };
};
