import { CameraScreen } from 'react-native-camera-kit';

import type { IScanCameraProps } from './types';

export type { IScanCameraProps };

export function ScanCamera({
  style,
  isActive,
  children,
  // eslint-disable-next-line spellcheck/spell-checker
  onScannedCode,
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
        onReadCode={(event) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, spellcheck/spell-checker
          onScannedCode?.(event.nativeEvent.codeStringValue);
        }}
        {...rest}
      />
      {children}
    </>
  );
}
