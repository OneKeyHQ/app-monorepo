export enum ModalTestRoutes {
  TestSimpleModal = 'TestSimpleModal',
}

export type ModalTestParamList = {
  [ModalTestRoutes.TestSimpleModal]: { question: string };
};
