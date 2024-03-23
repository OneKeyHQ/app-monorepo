export enum EModalReceiveRoutes {
  QrCode = 'QrCode',
  LightningCreateInvoice = 'LightningCreateInvoice',
}

export type IModalReceiveParamList = {
  [EModalReceiveRoutes.QrCode]: undefined;
  [EModalReceiveRoutes.LightningCreateInvoice]: {
    accountId: string;
    networkId: string;
    isTestnet: boolean;
  };
};
