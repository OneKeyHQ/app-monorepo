export enum EModalReceiveRoutes {
  ReceiveToken = 'ReceiveToken',
  CreateInvoice = 'CreateInvoice',
  ReceiveInvoice = 'ReceiveInvoice',
}

export type IModalReceiveParamList = {
  [EModalReceiveRoutes.ReceiveToken]: undefined;
  [EModalReceiveRoutes.CreateInvoice]: undefined;
  [EModalReceiveRoutes.ReceiveInvoice]: undefined;
};
