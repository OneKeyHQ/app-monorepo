export enum EScanQrCodeModalPages {
  ScanQrCodeStack = 'ScanQrCodeStack',
}

export type IScanQrCodeModalParamList = {
  [EScanQrCodeModalPages.ScanQrCodeStack]: {
    onCancel: () => void;
    callback: (params: {
      value: string;
      popNavigation: boolean;
      routeKey: string;
      isCaptureCurrent?: () => boolean;
      onResultDismiss?: () => boolean;
    }) => Promise<{ progress?: number; retry?: boolean }>;
    qrWalletScene?: boolean;
    showProTutorial?: boolean;
    scanRequestId?: string;
  };
};
