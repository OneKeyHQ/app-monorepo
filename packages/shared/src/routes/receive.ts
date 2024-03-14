export enum EModalReceiveRoutes {
  ReceiveToken = 'ReceiveToken',
  CreateInvoice = 'CreateInvoice',
  ReceiveInvoice = 'ReceiveInvoice',
}

export type IModalReceiveParamList = {
  [EModalReceiveRoutes.ReceiveToken]: {
    networkId: string;
    accountId: string;
    walletId: string;
  };
  [EModalReceiveRoutes.CreateInvoice]: undefined;
  [EModalReceiveRoutes.ReceiveInvoice]: undefined;
};
