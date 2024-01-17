export enum EModalReceiveRoutes {
  QrCode = 'QrCode',
  LightingInvoice = 'LightingInvoice',
}

export type IModalReceiveParamList = {
  [EModalReceiveRoutes.QrCode]: undefined;
  [EModalReceiveRoutes.LightingInvoice]: undefined;
};
