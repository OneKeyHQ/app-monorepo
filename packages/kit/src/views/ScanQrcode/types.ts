import { ReactNode } from 'react';

import { StyleProp, ViewStyle } from 'react-native';

export type ScanResultType = 'address' | 'url' | 'other';
export interface ScanResult {
  type: ScanResultType;
  data: string;
  possibleNetworks?: string[];
}

export enum ScanQrcodeRoutes {
  ScanQrcode = 'ScanQrcode',
  ScanQrcodeResult = 'ScanQrcodeResult',
  PreviewSend = 'PreviewSend',
}
export type ScanQrcodeRoutesParams = {
  [ScanQrcodeRoutes.ScanQrcode]:
    | undefined
    | {
        onScanCompleted: (data: string) => void;
      };
  [ScanQrcodeRoutes.ScanQrcodeResult]: ScanResult;
  [ScanQrcodeRoutes.PreviewSend]: {
    address: string;
    possibleNetworks?: string[];
  };
};

export interface ScanCameraProps {
  isActive: boolean;
  children: ReactNode;
  onQrcodeScanned: (code?: string) => void;
  style?: StyleProp<ViewStyle>;
}
