import { BarCodeScanner } from 'expo-barcode-scanner';
import { CameraView } from 'expo-camera';

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
    // navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
    //   stream.getTracks().forEach((track) => track.stop());
    // });
    return null;
  }
  return (
    <CameraView
      style={style}
      onBarcodeScanned={({ data }) => handleScanResult?.(data)}
      barcodeScannerSettings={{
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        barcodeTypes: [BarCodeScanner.Constants.BarCodeType.qr],
      }}
      {...rest}
    >
      {children}
    </CameraView>
  );
}
