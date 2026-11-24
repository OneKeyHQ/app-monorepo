import { useEffect, useState } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IScanCameraInfo } from './types';

type IQrScannerModule = typeof import('@onekeyfe/react-native-qr-scanner');

// Mac Catalyst has no scanner camera.
const qrScanner = platformEnv.isNativeIOSMacCatalyst
  ? undefined
  : (require('@onekeyfe/react-native-qr-scanner') as IQrScannerModule);

/** Cameras the scanner can switch between; refreshed on connect/disconnect. */
export function useScanCameras(_cameraReady: boolean): {
  cameras: IScanCameraInfo[];
  loaded: boolean;
} {
  const [state, setState] = useState<{
    cameras: IScanCameraInfo[];
    loaded: boolean;
  }>({ cameras: [], loaded: false });

  useEffect(() => {
    if (!qrScanner) return;
    let mounted = true;
    const refresh = () => {
      qrScanner
        .listCameras()
        .then((list) => {
          if (mounted) setState({ cameras: list, loaded: true });
        })
        .catch((error: unknown) => {
          if (mounted) setState({ cameras: [], loaded: true });
          console.error('[ScanCamera] listCameras failed', error);
        });
    };
    refresh();
    const unsubscribe = qrScanner.subscribeCameraChanges(refresh);
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return state;
}
