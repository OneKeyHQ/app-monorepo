import { useEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/native';
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
  const [isFocus, setIsFocus] = useState(false);
  const navigation = useNavigation();
  useEffect(() => {
    const focusUnsubscribe = navigation.addListener('focus', () => {
      setIsFocus(true);
    });

    const blurUnsubscribe = navigation.addListener('blur', () => {
      setIsFocus(false);
    });
    return () => {
      setTimeout(() => {
        blurUnsubscribe();
        focusUnsubscribe();
      });
    };
  }, [navigation]);

  return (
    <>
      {isFocus ? (
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
      ) : null}
      {children}
    </>
  );
}
