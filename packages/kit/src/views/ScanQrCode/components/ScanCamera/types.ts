import type { ViewProps } from 'react-native';

export type IScanCameraProps = ViewProps & {
  handleScanResult?: (value: string) => void;
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
