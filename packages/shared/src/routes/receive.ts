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
    addressType: string;
  };
  [EModalReceiveRoutes.CreateInvoice]: undefined;
  [EModalReceiveRoutes.ReceiveInvoice]: undefined;
};
