import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useScanCameraDiscovery } from './useScanCameraDiscovery';

type IQrScannerModule = typeof import('@onekeyfe/react-native-qr-scanner');

// Mac Catalyst has no scanner camera.
const qrScanner = platformEnv.isNativeIOSMacCatalyst
  ? undefined
  : (require('@onekeyfe/react-native-qr-scanner') as IQrScannerModule);

export function useScanCameras(
  _cameraReady: number,
  _useWebCamera?: boolean,
  _cameraActive?: boolean,
) {
  return useScanCameraDiscovery(qrScanner);
}
