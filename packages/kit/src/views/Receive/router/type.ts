export enum EReceivePages {
  QrCode = 'QrCode',
}

export type IReceiveParamList = {
  [EReceivePages.QrCode]: undefined;
};
