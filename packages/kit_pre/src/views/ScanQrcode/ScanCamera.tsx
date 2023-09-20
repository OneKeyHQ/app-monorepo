import type { FC } from 'react';

import { BarCodeScanner } from 'expo-barcode-scanner';
import { Camera } from 'expo-camera';

import type { ScanCameraProps } from './types';

const ScanCamera: FC<ScanCameraProps> = ({
  style,
  isActive,
  children,
  onQrcodeScanned,
}) =>
  isActive ? (
    <Camera
      style={style}
      onBarCodeScanned={({ data }) => onQrcodeScanned(data)}
      barCodeScannerSettings={{
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        barCodeTypes: [BarCodeScanner.Constants.BarCodeType.qr],
      }}
    >
      {children}
    </Camera>
  ) : null;
ScanCamera.displayName = 'ScanCamera';

export default ScanCamera;
