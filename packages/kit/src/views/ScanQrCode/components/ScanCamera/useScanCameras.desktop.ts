import { subscribeWebCameraChanges } from '@onekeyfe/react-native-qr-scanner/web';

import { useScanCameraDiscovery } from './useScanCameraDiscovery';
import { webCameraSource } from './useScanCameras.ts';

const desktopCameraSource = {
  listCameras: async () =>
    (await globalThis.desktopApi?.qrScanner?.listCameras()) ?? [],
  subscribeCameraChanges: subscribeWebCameraChanges,
};

export function useScanCameras(cameraReady: number, useWebCamera?: boolean) {
  const native = !useWebCamera && !!globalThis.desktopApi?.qrScanner;
  return useScanCameraDiscovery(
    native ? desktopCameraSource : webCameraSource,
    native ? undefined : cameraReady,
  );
}
