export enum ENativeFullModalTestRoutes {
  TestFullSimpleModal = 'TestFullSimpleModal',
}

export type IModalTestParamList = {
  [ENativeFullModalTestRoutes.TestFullSimpleModal]: { question: string };
};
