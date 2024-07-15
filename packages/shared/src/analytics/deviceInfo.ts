import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import type { IDeviceInfo, IGetDeviceInfo } from './type';

const deviceInfo = {
  deviceId: generateUUID(),
  screenHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
  screenWidth: typeof window !== 'undefined' ? window.innerWidth : 0,
} as IDeviceInfo;

if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('resize', () => {
    deviceInfo.screenHeight = window.innerHeight;
    deviceInfo.screenWidth = window.innerWidth;
  });
}

export const getDeviceInfo: IGetDeviceInfo = () => Promise.resolve(deviceInfo);
