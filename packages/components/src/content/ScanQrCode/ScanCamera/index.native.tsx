import { CameraScreen } from 'react-native-camera-kit';

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
      {/* @ts-expect-error */}
      <CameraScreen
        hideControls
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
