import {
  listWebCameras,
  subscribeWebCameraChanges,
} from '@onekeyfe/react-native-qr-scanner/web';

import { useScanCameraDiscovery } from './useScanCameraDiscovery';

export const webCameraSource = {
  listCameras: listWebCameras,
  subscribeCameraChanges: subscribeWebCameraChanges,
};

// Browsers may only expose camera IDs and labels after camera access.
export function useScanCameras(
  cameraReady: number,
  _useWebCamera?: boolean,
  _cameraActive?: boolean,
) {
  return useScanCameraDiscovery(webCameraSource, cameraReady);
}
