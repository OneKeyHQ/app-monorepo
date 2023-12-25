export enum EReceivePages {
  QrCode = 'QrCode',
  LightingInvoice = 'LightingInvoice',
}

export type IReceiveParamList = {
  [EReceivePages.QrCode]: undefined;
  [EReceivePages.LightingInvoice]: undefined;
};
