import { useCallback, useEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/native';
import { Camera, CameraType } from 'react-native-camera-kit';

import { usePreventRemove } from '@onekeyhq/components';

import { debugScanCameraLog } from '../../utils/debugScanCameraLog';

import type { IScanCameraProps } from './types';

export type { IScanCameraProps };

export function ScanCamera({
  children,
  handleScanResult,
  ...rest
}: IScanCameraProps) {
  const [isFocus, setIsFocus] = useState(true);
  const navigation = useNavigation();
  useEffect(() => {
    debugScanCameraLog('native-scan-camera-mount');
    return () => {
      debugScanCameraLog('native-scan-camera-unmount');
    };
  }, []);

  useEffect(() => {
    debugScanCameraLog('native-scan-camera-focus-state', {
      isFocus,
    });
  }, [isFocus]);

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
      debugScanCameraLog('native-prevent-remove', {
        actionType: data.action.type,
      });
      setIsFocus(false);
      setTimeout(() => {
        navigation.dispatch(data.action);
      }, 80);
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
          onError={({ nativeEvent }) => {
            debugScanCameraLog('native-camera-error', {
              errorMessage: nativeEvent.errorMessage,
            });
          }}
          onReadCode={({ nativeEvent: { codeStringValue } }) => {
            if (typeof codeStringValue !== 'string') {
              debugScanCameraLog('native-read-code-invalid');
              return;
            }
            debugScanCameraLog('native-read-code-success');
            handleScanResult?.(codeStringValue);
          }}
          {...rest}
        />
      ) : null}
      {children}
    </>
  );
}
