import { Camera } from 'react-native-camera-kit/src';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

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
    <>
      <Camera
        ref={(ref) =>
          ref === null && defaultLogger.scanQrCode.readQrCode.releaseCamera()
        }
        style={{ flex: 1 }}
        resizeMode="cover"
        scanBarcode
        onReadCode={({ nativeEvent: { codeStringValue } }) => {
          if (typeof codeStringValue !== 'string') {
            return;
          }
          handleScanResult?.(codeStringValue);
        }}
        {...rest}
      />
      {children}
    </>
  );
}
