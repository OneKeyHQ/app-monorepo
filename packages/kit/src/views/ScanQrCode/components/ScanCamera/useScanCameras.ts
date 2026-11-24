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
export function useScanCameras(cameraReady: number): {
  cameras: IScanCameraInfo[];
  loaded: boolean;
} {
  const [state, setState] = useState<{
    cameras: IScanCameraInfo[];
    loaded: boolean;
  }>({ cameras: [], loaded: false });

  useEffect(() => {
    let request = 0;
    const refresh = () => {
      request += 1;
      const current = request;
      listWebCameras()
        .then((list) => {
          if (current === request)
            setState({
              cameras: list,
              loaded: cameraReady > 0 && list.length > 0,
            });
        })
        .catch((error: unknown) => {
          if (current !== request) return;
          console.error('[ScanCamera] listWebCameras failed', error);
        });
    };
    refresh();
    const unsubscribe = subscribeWebCameraChanges(refresh);
    return () => {
      request += 1;
      unsubscribe();
    };
  }, [cameraReady]);

  return state;
}
