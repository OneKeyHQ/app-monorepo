import type { ReactNode } from 'react';

import type { UserInputCategory } from '@onekeyhq/engine/src/types/credential';

import type { StyleProp, ViewStyle } from 'react-native';

export enum ScanSubResultCategory {
  URL = 'url',
  TEXT = 'text',
  MIGRATE = 'migrate',
}

export type ScanResultCategory = UserInputCategory | ScanSubResultCategory;
export interface ScanResult {
  type: ScanResultCategory;
  data: string;
  // possibleNetworks?: string[];
  hideMoreMenu?: boolean;
}

export enum ScanQrcodeRoutes {
  ScanQrcode = 'ScanQrcode',
  ScanQrcodeResult = 'ScanQrcodeResult',
  PreviewSend = 'PreviewSend',
  RequestPermission = 'RequestPermission',
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
  [ScanQrcodeRoutes.RequestPermission]: undefined;
};

export interface ScanCameraProps {
  isActive: boolean;
  children: ReactNode;
  onQrcodeScanned: (code?: string) => void;
  style?: StyleProp<ViewStyle>;
}
