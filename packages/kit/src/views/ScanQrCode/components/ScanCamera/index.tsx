import { useEffect, useState } from 'react';

import { CameraView } from 'expo-camera';
import { View } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { isZXingReaderPrepared, prepareZXingReader } from './zxingReader';

import type { IScanCameraProps } from './types';

export type { IScanCameraProps };

export function ScanCamera({
  style,
  children,
  handleScanResult,
  // Native-only concern; stripped so it never reaches CameraView.
  disableNavigationGuard,
  ...rest
}: IScanCameraProps) {
  const [readerPrepared, setReaderPrepared] = useState(isZXingReaderPrepared);

  useEffect(() => {
    if (readerPrepared) {
      return;
    }
    let active = true;
    prepareZXingReader()
      .then(() => {
        if (active) {
          setReaderPrepared(true);
        }
      })
      .catch((error: unknown) => {
        console.error('[ScanCamera] Failed to prepare barcode scanning', error);
      });
    return () => {
      active = false;
    };
  }, [readerPrepared]);

  if (!readerPrepared) {
    return (
      <View style={style} {...rest}>
        {children}
      </View>
    );
  }

  return (
    <CameraView
      style={style}
      onBarcodeScanned={({ data }) => handleScanResult?.(data)}
      barcodeScannerSettings={{
        barcodeTypes: ['qr'],
      }}
      responsiveOrientationWhenOrientationLocked={platformEnv.isNativeIOSPad}
      {...rest}
    >
      {children}
    </CameraView>
  );
}
