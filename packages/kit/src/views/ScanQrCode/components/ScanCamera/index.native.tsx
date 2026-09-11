import { useCallback, useState } from 'react';

import { useNavigation } from '@react-navigation/native';
import { CameraView } from 'expo-camera';

import { usePreventRemove } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IScanCameraProps } from './types';

export type { IScanCameraProps };

/**
 * The screen-bound half of the native camera: unmount the Camera first,
 * dispatch the blocked navigation action a beat later — tearing the
 * camera down mid-transition wedges the native camera session. Both hooks
 * in here require a screen's navigation context, so hosts outside any
 * screen (the DeviceStage overlay) must opt out via
 * `disableNavigationGuard` — mounting this there throws at useRoute.
 */
function ScanCameraNavigationGuard({
  onPreventRemove,
}: {
  onPreventRemove: (dispatchBlockedAction: () => void) => void;
}) {
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
      onPreventRemove(() => {
        navigation.dispatch(data.action);
      });
    },
    [navigation, onPreventRemove],
  );
  usePreventRemove(true, onUsePreventRemove);
  return null;
}

export function ScanCamera({
  children,
  handleScanResult,
  disableNavigationGuard,
  ...rest
}: IScanCameraProps) {
  const [isFocus, setIsFocus] = useState(true);
  const onPreventRemove = useCallback((dispatchBlockedAction: () => void) => {
    setIsFocus(false);
    setTimeout(dispatchBlockedAction, 80);
  }, []);

  return (
    <>
      {disableNavigationGuard ? null : (
        <ScanCameraNavigationGuard onPreventRemove={onPreventRemove} />
      )}
      {isFocus ? (
        <CameraView
          style={rest.style ?? { flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          responsiveOrientationWhenOrientationLocked={
            platformEnv.isNativeIOSPad
          }
          onBarcodeScanned={({ data }) => {
            if (typeof data === 'string') {
              handleScanResult?.(data);
            }
          }}
          {...rest}
        />
      ) : null}
      {children}
    </>
  );
}
