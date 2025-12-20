import { useCallback, useState } from 'react';

import { useNavigation } from '@react-navigation/native';
import { Camera, CameraType } from 'react-native-camera-kit';

import { usePreventRemove } from '@onekeyhq/components';

import type { IScanCameraProps } from './types';

export type { IScanCameraProps };

export function ScanCamera({
  children,
  handleScanResult,
  ...rest
}: IScanCameraProps) {
  const [isFocus, setIsFocus] = useState(true);
  const navigation = useNavigation();
  const onUsePreventRemove = useCallback(
    ({
      data,
    }: {
      data: {
        action: Readonly<{
          type: string;
          payload?: object | undefined;
          source?: string | undefined;
          target?: string | undefined;
        }>;
      };
    }) => {
      setIsFocus(false);
      setTimeout(() => {
        navigation.dispatch(data.action);
      }, 350);
    },
    [navigation],
  );
  usePreventRemove(true, onUsePreventRemove);

  return (
    <>
      {isFocus ? (
        <Camera
          style={{ flex: 1 }}
          resizeMode="cover"
          showFrame={false}
          zoom={1}
          zoomMode="on"
          cameraType={CameraType.Back}
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
