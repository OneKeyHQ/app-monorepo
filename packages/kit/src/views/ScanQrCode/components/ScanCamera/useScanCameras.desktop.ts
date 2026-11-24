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
    const timer = setInterval(listener, NATIVE_CAMERA_REFRESH_INTERVAL);
    return () => clearInterval(timer);
  },
};

export function useScanCameras(
  cameraReady: number,
  useWebCamera?: boolean,
  cameraActive = true,
) {
  const native = !useWebCamera && !!globalThis.desktopApi?.qrScanner;
  const source = native ? desktopCameraSource : webCameraSource;
  return useScanCameraDiscovery(
    native && !cameraActive ? undefined : source,
    native ? undefined : cameraReady,
  );
}
