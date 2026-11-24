export enum EScanQrCodeModalPages {
  ScanQrCodeStack = 'ScanQrCodeStack',
}

export type IScanQrCodeModalParamList = {
  [EScanQrCodeModalPages.ScanQrCodeStack]: {
    callback: (params: {
      value: string;
      popNavigation: boolean;
      routeKey: string;
      onResultDismiss?: () => boolean;
    }) => Promise<{ progress?: number }>;
    qrWalletScene?: boolean;
    showProTutorial?: boolean;
    scanRequestId?: string;
  };
};
