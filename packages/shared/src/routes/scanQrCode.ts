export enum EScanQrCodeModalPages {
  ScanQrCodeStack = 'ScanQrCodeStack',
}

export type IScanQrCodeModalParamList = {
  [EScanQrCodeModalPages.ScanQrCodeStack]: {
    callback: (params: {
      value: string;
      popNavigation: boolean;
      canApplyScanResult?: () => boolean;
      waitForPhotoPicker?: () => Promise<void> | undefined;
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

type IScanModalRoute = {
  readonly params?: unknown;
  readonly state?: {
    readonly index?: number;
    readonly routes?: readonly IScanModalRoute[];
  };
};

export function getScanModalRequestId(route: IScanModalRoute) {
  type IScanParams = { scanRequestId?: string };
  const modalRoute = route.state?.routes?.[route.state.index ?? 0];
  const scanRoute = modalRoute?.state?.routes?.[modalRoute.state.index ?? 0];
  const scanParams = scanRoute?.params as IScanParams | undefined;
  const modalParams = modalRoute?.params as
    | { params?: IScanParams }
    | undefined;
  const rootParams = route.params as
    | { params?: { params?: IScanParams } }
    | undefined;
  return (
    scanParams?.scanRequestId ??
    modalParams?.params?.scanRequestId ??
    rootParams?.params?.params?.scanRequestId
  );
}
