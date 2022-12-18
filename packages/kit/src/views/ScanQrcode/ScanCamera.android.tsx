import type { FC } from 'react';

import { RNCamera as Camera } from 'react-native-camera';

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
      captureAudio={false}
      onGoogleVisionBarcodesDetected={({ barcodes }) =>
        barcodes.length && onQrcodeScanned(barcodes[0].data)
      }
      googleVisionBarcodeType={
        Camera.Constants.GoogleVisionBarcodeDetection.BarcodeType.QR_CODE
      }
    >
      {children}
    </Camera>
  ) : null;
ScanCamera.displayName = 'ScanCamera';

export default ScanCamera;
