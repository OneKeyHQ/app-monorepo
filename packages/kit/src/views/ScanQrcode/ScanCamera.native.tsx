import type { FC } from 'react';

import { CameraScreen } from 'react-native-camera-kit';

import type { ScanCameraProps } from './types';

const ScanCamera: FC<ScanCameraProps> = ({
  isActive,
  children,
  onQrcodeScanned,
}) =>
  isActive ? (
    <>
      {/* @ts-expect-error */}
      <CameraScreen
        hideControls
        scanBarcode
        onReadCode={(event) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          onQrcodeScanned(event.nativeEvent.codeStringValue);
        }}
      />
      {children}
    </>
  ) : null;

export default ScanCamera;
