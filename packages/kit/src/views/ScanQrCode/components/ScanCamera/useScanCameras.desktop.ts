import { useMemo } from 'react';

import type { IDesktopQrScanner } from '@onekeyhq/shared/types/desktopQrScanner';

import { useScanCameraDiscovery } from './useScanCameraDiscovery';
import { webCameraSource } from './useScanCameras.ts';

const NATIVE_CAMERA_REFRESH_INTERVAL = 2000;

function createNativeCameraSource() {
  let pendingList: ReturnType<IDesktopQrScanner['listCameras']> | undefined;

  return {
    listCameras: async () => {
      if (pendingList) return pendingList;

      const scanner = globalThis.desktopApi?.qrScanner;
      if (!scanner) return null;
      pendingList = scanner.listCameras();
      try {
        return await pendingList;
      } finally {
        pendingList = undefined;
      }
    },
    subscribeCameraChanges: (listener: () => void) => {
      // The desktop SDK exposes enumeration without a device-change subscription.
      const timer = setInterval(listener, NATIVE_CAMERA_REFRESH_INTERVAL);
      return () => clearInterval(timer);
    },
  };
}

export function useScanCameras(
  cameraReady: number,
  useWebCamera?: boolean,
  cameraActive = true,
) {
  const native = !useWebCamera && !!globalThis.desktopApi?.qrScanner;
  const source = useMemo(() => {
    if (!native) return webCameraSource;
    // Each activation waits for its own enumeration before starting capture.
    return cameraActive ? createNativeCameraSource() : undefined;
  }, [cameraActive, native]);
  return useScanCameraDiscovery(source, native ? undefined : cameraReady);
}
