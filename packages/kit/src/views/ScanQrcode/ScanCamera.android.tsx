import React, { FC } from 'react';

import { RNCamera as Camera } from 'react-native-camera';

import { ScanCameraProps } from './types';

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
      onBarCodeRead={(event) => onQrcodeScanned(event.data)}
      barCodeTypes={[Camera.Constants.BarCodeType.qr]}
    >
      {children}
    </Camera>
  ) : null;
ScanCamera.displayName = 'ScanCamera';

export default ScanCamera;
