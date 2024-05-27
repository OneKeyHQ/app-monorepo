export enum EScanQrCodeModalPages {
  ScanQrCodeStack = 'ScanQrCodeStack',
}

export type IScanQrCodeModalParamList = {
  [EScanQrCodeModalPages.ScanQrCodeStack]: {
    callback: (value: string) => Promise<{ progress?: number }>;
    mask?: boolean;
  };
};
