export enum EScanQrCodeModalPages {
  ScanQrCodeStack = 'ScanQrCodeStack',
}

export type IScanQrCodeModalParamList = {
  [EScanQrCodeModalPages.ScanQrCodeStack]: {
    callback: (params: {
      value: string;
      popNavigation: () => void;
    }) => Promise<{ progress?: number }>;
    qrWalletScene?: boolean;
    showProTutorial?: boolean;
  };
};
