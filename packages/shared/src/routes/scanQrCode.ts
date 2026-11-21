export enum EScanQrCodeModalPages {
  ScanQrCodeStack = 'ScanQrCodeStack',
}

export type IScanQrCodeModalParamList = {
  [EScanQrCodeModalPages.ScanQrCodeStack]: {
    callback: (params: {
      value: string;
      popNavigation: boolean;
      canApplyScanResult?: () => boolean;
      scanSignal?: AbortSignal;
      holdForChildScan?: () => () => void;
      isScanOpen?: () => boolean;
      onResultWillClose?: () => void;
    }) => Promise<{ progress?: number; retry?: boolean }>;
    qrWalletScene?: boolean;
    showProTutorial?: boolean;
    scanRequestId?: string;
  };
};
