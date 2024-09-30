import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import type { IDeviceInfo, IGetDeviceInfo } from './type';

const deviceInfo = {
  deviceId: generateUUID(),
  arch: window.desktopApi.arch || 'unknown',
  os: window.desktopApi.platform,
  osVersion: window.desktopApi.systemVersion,
  screenHeight: typeof window !== 'undefined' ? window.innerHeight : undefined,
  screenWidth: typeof window !== 'undefined' ? window.innerWidth : undefined,
} as IDeviceInfo;

if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('resize', () => {
    deviceInfo.screenHeight = window.innerHeight;
    deviceInfo.screenWidth = window.innerWidth;
  });
}

export const getDeviceInfo: IGetDeviceInfo = () => Promise.resolve(deviceInfo);
