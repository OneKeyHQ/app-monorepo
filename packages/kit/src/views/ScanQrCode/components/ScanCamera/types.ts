import type { ViewProps } from 'react-native';

export type IScanCameraProps = ViewProps & {
  handleScanResult?: (value: string) => void;
  /**
   * Skip the native screen-removal guard (usePreventRemove + navigation
   * dispatch). Required when the camera is hosted outside any screen —
   * the DeviceStage overlay's viewfinder — where the guard's hooks have
   * no route context and throw. Screen-hosted scanners leave it unset.
   */
  disableNavigationGuard?: boolean;
};
