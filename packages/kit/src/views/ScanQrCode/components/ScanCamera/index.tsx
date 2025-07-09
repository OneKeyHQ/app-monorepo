import { CameraView } from 'expo-camera';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IScanCameraProps } from './types';

export type { IScanCameraProps };

export function ScanCamera({
  style,
  children,
  handleScanResult,
  ...rest
}: IScanCameraProps) {
  return (
    <CameraView
      style={style}
      onBarcodeScanned={({ data }) => handleScanResult?.(data)}
      barcodeScannerSettings={{
        barcodeTypes: ['qr'],
      }}
      responsiveOrientationWhenOrientationLocked={platformEnv.isNativeIOSPad}
      {...rest}
    >
      {children}
    </CameraView>
  );
}
