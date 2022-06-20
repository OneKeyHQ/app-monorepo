import React, { FC } from 'react';

import { runOnJS } from 'react-native-reanimated';
import {
  Camera,
  useCameraDevices,
  useFrameProcessor,
} from 'react-native-vision-camera';
import { BarcodeFormat, scanBarcodes } from 'vision-camera-code-scanner';

import { ScanCameraProps } from './types';

const ScanCamera: FC<ScanCameraProps> = ({
  style,
  isActive,
  children,
  onQrcodeScanned,
}) => {
  const devices = useCameraDevices();
  const device = devices.back;
  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';

    const detectedBarcodes = scanBarcodes(frame, [BarcodeFormat.QR_CODE], {
      checkInverted: true,
    });
    runOnJS(onQrcodeScanned)(detectedBarcodes[0]?.rawValue);
  }, []);
  return device ? (
    <>
      <Camera
        style={style}
        device={device}
        isActive={isActive}
        frameProcessor={frameProcessor}
        frameProcessorFps={5}
      />
      {children}
    </>
  ) : null;
};
ScanCamera.displayName = 'ScanCamera';

export default ScanCamera;
