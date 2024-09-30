import { BarCodeScanner } from 'expo-barcode-scanner';
import { Camera } from 'expo-camera';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

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
    // void navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
    //   stream.getVideoTracks().forEach((track) => track.stop());
    //   stream.getTracks().forEach((track) => track.stop());
    // });
    return null;
  }
  return (
    <Camera
      ref={(ref) =>
        ref === null && defaultLogger.scanQrCode.readQrCode.releaseCamera()
      }
      style={style}
      onBarCodeScanned={({ data }) => handleScanResult?.(data)}
      barCodeScannerSettings={{
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        barCodeTypes: [BarCodeScanner.Constants.BarCodeType.qr],
      }}
      responsiveOrientationWhenOrientationLocked={platformEnv.isNativeIOSPad}
      {...rest}
    >
      {children}
    </Camera>
  );
}
