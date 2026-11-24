import type {
  QrCameraInfo,
  QrScannerErrorCode,
} from '@onekeyfe/react-native-qr-scanner/web';
import type { ViewProps } from 'react-native';

export type IScanCameraProps = ViewProps & {
  handleScanResult?: (value: string) => void;
  /** Camera failures: `permission-denied`, `no-camera`, `camera-busy`, ... */
  onCameraError?: (code: QrScannerErrorCode) => void;
  /** The camera started delivering frames (again, after a switch). */
  onCameraReady?: (activeCameraId?: string) => void;
  /** `IScanCameraInfo.id`; unset or disconnected uses the default camera. */
  cameraId?: string;
  useWebCamera?: boolean;
  onWebCameraFallback?: () => void;
  /**
   * Keep the camera active without a screen route. Required by the DeviceStage
   * overlay, whose viewfinder has no navigation context. Screen-hosted scanners
   * leave it unset so navigation transitions control camera activity.
   */
  disableNavigationGuard?: boolean;
};

export type IScanCameraRef = {
  dispose: () => void;
};

export type IScanCameraInfo = QrCameraInfo;
