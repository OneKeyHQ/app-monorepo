export type ScanResultType = 'address' | 'url' | 'other';
export interface ScanResult {
  type: ScanResultType;
  data: string;
  possibleNetworks?: string[];
}

export enum ScanQrcodeRoutes {
  ScanQrcode = 'ScanQrcode',
  ScanQrcodeResult = 'ScanQrcodeResult',
  SelectAccountAndNetwork = 'SelectAccountAndNetwork',
}
export type ScanQrcodeRoutesParams = {
  [ScanQrcodeRoutes.ScanQrcode]: {
    onScanCompleted?: (data: string) => void;
  };
  [ScanQrcodeRoutes.ScanQrcodeResult]: ScanResult;
  [ScanQrcodeRoutes.SelectAccountAndNetwork]: {
    address: string;
    possibleNetworks?: string[];
  };
};
