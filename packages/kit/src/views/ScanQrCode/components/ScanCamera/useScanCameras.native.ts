import { useEffect, useState } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IScanCameraInfo } from './types';

type IQrScannerModule = typeof import('@onekeyfe/react-native-qr-scanner');

// Mac Catalyst has no scanner camera.
const qrScanner = platformEnv.isNativeIOSMacCatalyst
  ? undefined
  : (require('@onekeyfe/react-native-qr-scanner') as IQrScannerModule);

/** Cameras the scanner can switch between; refreshed on connect/disconnect. */
export function useScanCameras(_cameraReady: number): {
  cameras: IScanCameraInfo[];
  loaded: boolean;
} {
  const [state, setState] = useState<{
    cameras: IScanCameraInfo[];
    loaded: boolean;
  }>({ cameras: [], loaded: false });

  useEffect(() => {
    if (!qrScanner) return;
    let request = 0;
    const refresh = () => {
      request += 1;
      const current = request;
      qrScanner
        .listCameras()
        .then((list) => {
          if (current === request) setState({ cameras: list, loaded: true });
        })
        .catch((error: unknown) => {
          if (current !== request) return;
          console.error('[ScanCamera] listCameras failed', error);
        });
    };
    refresh();
    const unsubscribe = qrScanner.subscribeCameraChanges(refresh);
    return () => {
      request += 1;
      unsubscribe();
    };
  }, []);

  return state;
}
