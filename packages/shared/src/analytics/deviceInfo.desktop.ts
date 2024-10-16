import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import type { IDeviceInfo, IGetDeviceInfo } from './type';

const deviceInfo = {
  deviceId: generateUUID(),
  arch: globalThis.desktopApi.arch || 'unknown',
  os: globalThis.desktopApi.platform,
  osVersion: globalThis.desktopApi.systemVersion,
  screenHeight:
    typeof globalThis !== 'undefined' ? window.innerHeight : undefined,
  screenWidth:
    typeof globalThis !== 'undefined' ? window.innerWidth : undefined,
} as IDeviceInfo;

if (typeof globalThis !== 'undefined' && window.addEventListener) {
  window.addEventListener('resize', () => {
    deviceInfo.screenHeight = window.innerHeight;
    deviceInfo.screenWidth = window.innerWidth;
  });
}

export const getDeviceInfo: IGetDeviceInfo = () => Promise.resolve(deviceInfo);
