import type { IDesktopQrScanner } from '@onekeyhq/shared/types/desktopQrScanner';

import { useScanCameraDiscovery } from './useScanCameraDiscovery';
import { webCameraSource } from './useScanCameras.ts';

const NATIVE_CAMERA_REFRESH_INTERVAL = 2000;

let pendingNativeList: ReturnType<IDesktopQrScanner['listCameras']> | undefined;

const desktopCameraSource = {
  listCameras: async () => {
    if (pendingNativeList) return pendingNativeList;

    const scanner = globalThis.desktopApi?.qrScanner;
    if (!scanner) return null;
    pendingNativeList = scanner.listCameras();
    try {
      return await pendingNativeList;
    } finally {
      pendingNativeList = undefined;
    }
  },
  subscribeCameraChanges: (listener: () => void) => {
    // The desktop SDK exposes enumeration without a device-change subscription.
    const refreshIfVisible = () => {
      if (document.visibilityState !== 'hidden') listener();
    };
    const timer = setInterval(refreshIfVisible, NATIVE_CAMERA_REFRESH_INTERVAL);
    document.addEventListener('visibilitychange', refreshIfVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  },
};

export function useScanCameras(cameraReady: number, useWebCamera?: boolean) {
  const native = !useWebCamera && !!globalThis.desktopApi?.qrScanner;
  return useScanCameraDiscovery(
    native ? desktopCameraSource : webCameraSource,
    native ? undefined : cameraReady,
  );
}
