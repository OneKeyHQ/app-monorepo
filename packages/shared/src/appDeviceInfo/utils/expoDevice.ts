import * as ExpoDevice from 'expo-device';
import { DeviceType } from 'expo-device';

import type { IAppDeviceType } from '../types';

export type IExpoDeviceData = typeof ExpoDevice;

export function getExpoDeviceResult() {
  let appDeviceType: IAppDeviceType | undefined;
  switch (ExpoDevice.deviceType) {
    case DeviceType.PHONE:
      appDeviceType = 'mobile';
      break;
    case DeviceType.TABLET:
      appDeviceType = 'tablet';
      break;
    case DeviceType.DESKTOP:
      appDeviceType = 'desktop';
      break;
    case DeviceType.TV:
      appDeviceType = 'smarttv';
      break;
    default:
      appDeviceType = undefined;
  }

  return {
    ...ExpoDevice,
    appDeviceType,
  };
}
