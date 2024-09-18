import { Camera } from 'react-native-camera-kit/src';

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
