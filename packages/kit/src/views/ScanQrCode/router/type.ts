export enum EScanQrCodeModalPages {
  ScanQrCodeModal = 'ScanQrCodeModal',
}

export type IScanQrCodeModalParamList = {
  [EScanQrCodeModalPages.ScanQrCodeModal]: {
    callback: (value: string) => void;
  };
};
