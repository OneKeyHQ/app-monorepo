import { useEffect, useState } from 'react';

import {
  listWebCameras,
  subscribeWebCameraChanges,
} from '@onekeyfe/react-native-qr-scanner/web';

import type { IScanCameraInfo } from './types';

/**
 * Browser cameras. Labels and often the full list appear only after camera
 * access was granted, so the list is read again once the camera is ready.
 */
export function useScanCameras(cameraReady: boolean): {
  cameras: IScanCameraInfo[];
  loaded: boolean;
} {
  const [state, setState] = useState<{
    cameras: IScanCameraInfo[];
    loaded: boolean;
  }>({ cameras: [], loaded: false });

  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      listWebCameras()
        .then((list) => {
          if (mounted) setState({ cameras: list, loaded: true });
        })
        .catch((error: unknown) => {
          if (mounted) setState({ cameras: [], loaded: true });
          console.error('[ScanCamera] listWebCameras failed', error);
        });
    };
    refresh();
    const unsubscribe = subscribeWebCameraChanges(refresh);
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [cameraReady]);

  return state;
}
