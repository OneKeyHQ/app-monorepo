import { BarCodeScanner } from 'expo-barcode-scanner';
import { Camera } from 'expo-camera';

import type { IScanCameraProps } from './types';

export type { IScanCameraProps };

export function ScanCamera({
  style,
  isActive,
  children,
  handleScanResult,
  ...rest
}: IScanCameraProps) {
  if (!isActive) {
    return null;
  }
  return (
    <Camera
      style={style}
      onBarCodeScanned={({ data }) => handleScanResult?.(data)}
      barCodeScannerSettings={{
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        barCodeTypes: [BarCodeScanner.Constants.BarCodeType.qr],
      }}
      {...rest}
    >
      {children}
    </Camera>
  );
}
